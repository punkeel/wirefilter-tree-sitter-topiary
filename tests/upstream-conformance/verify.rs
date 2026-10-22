use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::process;
use wirefilter::{
    FunctionArgs, LhsValue, NeverList, SchemeBuilder, SimpleFunctionArgKind,
    SimpleFunctionDefinition, SimpleFunctionImpl, SimpleFunctionParam, Type,
};

#[derive(Debug, Deserialize)]
struct Fixture {
    scheme: SchemeSpec,
    cases: Vec<Case>,
}

#[derive(Debug, Deserialize)]
struct SchemeSpec {
    fields: BTreeMap<String, String>,
    #[serde(default)]
    functions: BTreeMap<String, FunctionSpec>,
    #[serde(default)]
    lists: Vec<ListSpec>,
}

#[derive(Debug, Deserialize)]
struct FunctionSpec {
    parameters: Vec<ParameterSpec>,
    #[serde(rename = "return")]
    return_type: String,
}

#[derive(Debug, Deserialize)]
struct ParameterSpec {
    kind: String,
    #[serde(rename = "type")]
    value_type: String,
}

#[derive(Debug, Deserialize)]
struct ListSpec {
    #[allow(dead_code)]
    name: String,
    #[serde(rename = "type")]
    value_type: String,
}

#[derive(Debug, Deserialize)]
struct Case {
    id: String,
    kind: String,
    source: String,
    #[serde(rename = "expectedAst")]
    expected_ast: Option<Value>,
}

fn parse_type(spec: &str) -> Type {
    match spec {
        "Bool" => Type::Bool,
        "Int" => Type::Int,
        "Ip" => Type::Ip,
        "Bytes" => Type::Bytes,
        _ if spec.starts_with("Array(") && spec.ends_with(')') => {
            Type::Array(parse_type(&spec[6..spec.len() - 1]).into())
        }
        _ if spec.starts_with("Map(") && spec.ends_with(')') => {
            Type::Map(parse_type(&spec[4..spec.len() - 1]).into())
        }
        _ => panic!("unsupported fixture type: {spec}"),
    }
}

fn no_op<'i, 'a>(_args: FunctionArgs<'i, 'a>) -> Option<LhsValue<'a>> {
    None
}

fn build_scheme(spec: &SchemeSpec) -> SchemeBuilder {
    let mut builder = SchemeBuilder::new();

    for (name, value_type) in &spec.fields {
        builder
            .add_field(name, parse_type(value_type))
            .expect("fixture field registration");
    }

    for (name, function) in &spec.functions {
        let parameters = function
            .parameters
            .iter()
            .map(|parameter| {
                let arg_kind = match parameter.kind.as_str() {
                    "field" => SimpleFunctionArgKind::Field,
                    "both" => SimpleFunctionArgKind::Both,
                    "literal" => SimpleFunctionArgKind::Literal,
                    other => panic!("unsupported function argument kind: {other}"),
                };
                SimpleFunctionParam {
                    arg_kind,
                    val_type: parse_type(&parameter.value_type),
                }
            })
            .collect::<Vec<_>>()
            .into_boxed_slice();

        builder
            .add_function(
                name,
                SimpleFunctionDefinition {
                    params: parameters,
                    opt_params: Box::new([]),
                    return_type: parse_type(&function.return_type),
                    implementation: SimpleFunctionImpl::new(no_op),
                },
            )
            .expect("fixture function registration");
    }

    for list in &spec.lists {
        builder
            .add_list(parse_type(&list.value_type), NeverList::default())
            .expect("fixture list registration");
    }

    builder
}

fn main() {
    let cases_path = env::args()
        .nth(1)
        .unwrap_or_else(|| "tests/upstream-conformance/cases.json".to_owned());
    let fixture: Fixture =
        serde_json::from_str(&fs::read_to_string(&cases_path).expect("read fixture cases"))
            .expect("decode fixture cases");
    let scheme = build_scheme(&fixture.scheme).build();
    let mut failures = Vec::new();
    let mut valid_count = 0;
    let mut invalid_count = 0;

    for case in &fixture.cases {
        let parsed = scheme.parse(&case.source);
        match case.kind.as_str() {
            "valid" => {
                valid_count += 1;
                match parsed {
                    Ok(ast) => {
                        if let Some(expected) = &case.expected_ast {
                            let actual = serde_json::to_value(&ast).expect("serialize upstream AST");
                            if &actual != expected {
                                failures.push(format!(
                                    "{}: upstream AST mismatch\nexpected: {}\nactual: {}",
                                    case.id, expected, actual
                                ));
                            }
                        }
                    }
                    Err(error) => failures.push(format!(
                        "{}: upstream rejected valid syntax: {}",
                        case.id, error
                    )),
                }
            }
            "invalid" => {
                invalid_count += 1;
                if let Ok(ast) = parsed {
                    failures.push(format!(
                        "{}: upstream accepted malformed syntax as {:?}",
                        case.id, ast
                    ));
                }
            }
            other => failures.push(format!("{}: unknown case kind {other}", case.id)),
        }
    }

    if failures.is_empty() {
        println!(
            "PASS upstream Rust conformance: {valid_count} valid and {invalid_count} malformed cases"
        );
    } else {
        eprintln!("{}", failures.join("\n\n"));
        process::exit(1);
    }
}
