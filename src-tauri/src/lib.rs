use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// 采集器 → UI 的契约，与 src/hardware/contract.ts 一一对应。
// 契约只表达「到了什么」；`骨架` 由 UI 侧从「还没收到」推出来。
//
// `enum`（枚举）也是契约里的结构：采集器只吐 WMI 的原始值，翻成人话是 UI 侧
// `src/hardware/enums.ts` 的事，这样翻译能在没有 Windows 的环境里测。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EnumTable {
    MemoryType,
    SystemType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ValuePart {
    Text { text: String },
    Enum { table: EnumTable, code: u32 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SnapshotValue {
    Value {
        text: String,
    },
    Parts {
        parts: Vec<ValuePart>,
    },
    Pair {
        lead: String,
        nominal: String,
        actual: String,
    },
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldId {
    Model,
    System,
    Uptime,
    Processor,
    Mainboard,
    Memory,
    Gpu,
    Display,
    Disk,
    Sound,
    Network,
    Battery,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FieldUpdate {
    pub field: FieldId,
    pub values: Vec<SnapshotValue>,
}

// 采集脚本在编译期内嵌，运行时作为 `-Command` 的一个参数交给 PowerShell。
const COLLECT_SCRIPT: &str = include_str!("collect.ps1");

#[derive(Default)]
struct Collection {
    started: AtomicBool,
}

// 启动时采集一次就冻住（ADR-0001）。StrictMode 下前端可能调两次 collect；
// `started` 保证一个进程只 spawn 一个 PowerShell。
#[tauri::command]
fn collect(app: AppHandle, collection: State<'_, Collection>) {
    if collection.started.swap(true, Ordering::SeqCst) {
        return;
    }

    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = run_collection(&app) {
            let _ = app.emit("collection-error", error);
        }
        // 流关闭：UI 据此把仍未回值的格子从 `骨架` 翻成 `未知`。
        let _ = app.emit("collection-complete", ());
    });
}

fn run_collection(app: &AppHandle) -> Result<(), String> {
    let mut child = spawn_shell(COLLECT_SCRIPT)?;
    let stdout = child.stdout.take().ok_or("PowerShell 没有 stdout")?;

    // 逐行读：脚本每解析出一个字段就吐一行 JSON，Rust 读到一行就发一条事件。
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| error.to_string())?;
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        match serde_json::from_str::<FieldUpdate>(line) {
            Ok(update) => {
                let _ = app.emit("field-update", update);
            }
            Err(error) => {
                let _ = app.emit("collection-error", format!("无法解析的字段行：{error}"));
            }
        }
    }

    let status = child.wait().map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("PowerShell 以 {status} 退出"))
    }
}

// ADR-0004：优先 pwsh，退回 powershell 5.1。
fn spawn_shell(script: &str) -> Result<Child, String> {
    let mut last_error = String::from("找不到 pwsh 或 powershell");
    for shell in ["pwsh", "powershell"] {
        let mut command = Command::new(shell);
        command
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        // GUI 应用不该闪出控制台窗口。
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        match command.spawn() {
            Ok(child) => return Ok(child),
            Err(error) => last_error = format!("无法启动 {shell}：{error}"),
        }
    }
    Err(last_error)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Collection::default())
        .invoke_handler(tauri::generate_handler![collect])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 契约测试。夹具是真实探针输出（见 fixtures/README.md），同一份文件也被
// UI 测试 src/hardware/fixture.test.tsx 读取——契约两侧共用一个事实源。
#[cfg(test)]
mod contract_fixture {
    use super::{EnumTable, FieldId, FieldUpdate, SnapshotValue, ValuePart, COLLECT_SCRIPT};

    const FIXTURE: &str = include_str!("../../fixtures/field-updates.jsonl");

    const ALL_FIELDS: [FieldId; 12] = [
        FieldId::Model,
        FieldId::System,
        FieldId::Uptime,
        FieldId::Processor,
        FieldId::Mainboard,
        FieldId::Memory,
        FieldId::Gpu,
        FieldId::Display,
        FieldId::Disk,
        FieldId::Sound,
        FieldId::Network,
        FieldId::Battery,
    ];

    fn lines() -> impl Iterator<Item = &'static str> {
        FIXTURE.lines().map(str::trim).filter(|line| !line.is_empty())
    }

    fn updates() -> Vec<FieldUpdate> {
        lines()
            .map(|line| {
                serde_json::from_str::<FieldUpdate>(line)
                    .unwrap_or_else(|error| panic!("夹具里的这一行不是合法的 FieldUpdate：{line}\n{error}"))
            })
            .collect()
    }

    #[test]
    fn fixture_deserializes_into_snapshot_types() {
        let updates = updates();
        assert_eq!(updates.len(), 12, "夹具应当每个字段恰好一行");
    }

    #[test]
    fn fixture_covers_every_field_id() {
        let updates = updates();
        for field in ALL_FIELDS {
            assert!(
                updates.iter().any(|update| update.field == field),
                "夹具缺少字段 {field:?}"
            );
        }
        assert_eq!(updates.len(), ALL_FIELDS.len(), "夹具里出现了重复字段或契约外的行");
    }

    #[test]
    fn fixture_exercises_multi_value_and_pair() {
        let updates = updates();
        assert!(
            updates.iter().any(|update| update.values.len() >= 2),
            "夹具应当含多值行"
        );
        assert!(
            updates
                .iter()
                .flat_map(|update| &update.values)
                .any(|value| matches!(value, SnapshotValue::Pair { .. })),
            "夹具应当含一条并陈"
        );
    }

    #[test]
    fn fixture_exercises_enum_translation() {
        // 枚举翻译（#4）：夹具里的内存与型号必须走 `parts` + `enum`，
        // 而不是采集侧拼好的 `DDR4` —— 否则 UI 侧没有可翻的东西。
        let updates = updates();
        let parts: Vec<&ValuePart> = updates
            .iter()
            .flat_map(|update| &update.values)
            .filter_map(|value| match value {
                SnapshotValue::Parts { parts } => Some(parts),
                _ => None,
            })
            .flatten()
            .collect();
        assert!(
            parts.iter().any(|part| matches!(
                part,
                ValuePart::Enum {
                    table: EnumTable::MemoryType,
                    code: 26
                }
            )),
            "夹具应当含 `SMBIOSMemoryType = 26`"
        );
        assert!(
            parts.iter().any(|part| matches!(
                part,
                ValuePart::Enum {
                    table: EnumTable::SystemType,
                    code: 2
                }
            )),
            "夹具应当含 `PCSystemType = 2`"
        );
    }

    #[test]
    fn accepts_enum_parts_in_contract() {
        let line = r#"{"field":"memory","values":[{"kind":"parts","parts":[{"kind":"text","text":"x "},{"kind":"enum","table":"memoryType","code":26}]}]}"#;
        let update = serde_json::from_str::<FieldUpdate>(line).expect("parts/enum 是契约内的值");
        assert!(matches!(update.values[..], [SnapshotValue::Parts { .. }]));
    }

    #[test]
    fn rejects_unknown_enum_table() {
        let line = r#"{"field":"memory","values":[{"kind":"parts","parts":[{"kind":"enum","table":"frontier","code":1}]}]}"#;
        let parsed = serde_json::from_str::<FieldUpdate>(line);
        assert!(parsed.is_err(), "契约外的 EnumTable 竟然被接受了：{parsed:?}");
    }

    #[test]
    fn rejects_field_outside_contract() {
        // 脚本一旦吐出契约外的 FieldId，这里就得红。
        let line = r#"{"field":"frontier","values":[{"kind":"value","text":"x"}]}"#;
        let parsed = serde_json::from_str::<FieldUpdate>(line);
        assert!(parsed.is_err(), "契约外的 FieldId 竟然被接受了：{parsed:?}");
    }

    #[test]
    fn rejects_value_outside_contract() {
        let line = r#"{"field":"processor","values":[{"kind":"guess","text":"x"}]}"#;
        let parsed = serde_json::from_str::<FieldUpdate>(line);
        assert!(parsed.is_err(), "契约外的 SnapshotValue 竟然被接受了：{parsed:?}");
    }

    #[test]
    fn accepts_unknown_value_in_contract() {
        // `未知` 是契约里的第三种形态（采集器的主动放弃），夹具里没有它，单独锁一下。
        let line = r#"{"field":"battery","values":[{"kind":"unknown"}]}"#;
        let update = serde_json::from_str::<FieldUpdate>(line).expect("未知 是契约内的值");
        assert!(matches!(update.values[..], [SnapshotValue::Unknown]));
    }

    #[test]
    fn every_field_the_script_emits_is_in_the_contract() {
        // 这条才是 AC 要的：脚本一旦吐出契约外的 FieldId（比如 mainboard -> motherboard），
        // 测试就红。rejects_field_outside_contract 锁的是反序列化行为，这条锁的是脚本本身。
        let emitted = emitted_field_names(COLLECT_SCRIPT);
        assert!(!emitted.is_empty(), "脚本里一个字段都没解析出来——测试自身失效了");
        for name in emitted {
            assert!(
                serde_json::from_str::<FieldId>(&format!("\"{name}\"")).is_ok(),
                "脚本吐出了契约外的 FieldId：{name}"
            );
        }
    }

    #[test]
    fn every_field_the_script_emits_has_its_own_budget() {
        // `查询上限`：每个字段各有一个，不是一个全局值（#4）。
        // 新加字段却忘了给它上限时，这里就红——不然 Query 会静静降级成 `未知`。
        let budgets = budget_field_names(COLLECT_SCRIPT);
        assert!(!budgets.is_empty(), "脚本里没解析出 $BudgetMs——测试自身失效了");
        for name in emitted_field_names(COLLECT_SCRIPT) {
            assert!(budgets.contains(&name), "字段 {name} 没有自己的查询上限");
        }
    }

    #[test]
    fn device_tree_whitelist_covers_real_bus_prefixes() {
        // `实例过滤`（#5）：多值行只列 `物理设备`——`PNPDeviceID` 以真实总线前缀
        // 开头的那些，其余默认排除（ADR-0003）。这里锁住 AC 点名的前缀：白名单
        // 被清空、或退化成黑名单时红。
        let prefixes = real_bus_prefixes(COLLECT_SCRIPT);
        for expected in [
            "PCI\\",
            "USB\\",
            "SCSI\\",
            "NVME\\",
            "INTELAUDIO\\",
            "HDAUDIO\\",
            "DISPLAY\\",
        ] {
            assert!(
                prefixes.iter().any(|prefix| prefix == expected),
                "真实总线白名单里缺了 {expected}：{prefixes:?}"
            );
        }
    }

    // 抠出脚本里 `Emit-Field '<id>'` / `Collect '<id>'` 的字段名；函数定义因为
    // 下一个字符不是引号，会被跳过。
    fn emitted_field_names(script: &str) -> Vec<String> {
        let mut names = Vec::new();
        for token in ["Emit-Field", "Collect"] {
            for (index, _) in script.match_indices(token) {
                let rest = script[index + token.len()..].trim_start();
                let Some(quote) = rest
                    .chars()
                    .next()
                    .filter(|character| *character == '\'' || *character == '"')
                else {
                    continue;
                };
                let body = &rest[quote.len_utf8()..];
                if let Some(end) = body.find(quote) {
                    names.push(body[..end].to_string());
                }
            }
        }
        names
    }

    // 抠出 `$RealBusPrefixes = @( ... )` 里的前缀字符串。
    fn real_bus_prefixes(script: &str) -> Vec<String> {
        let start = script
            .find("$RealBusPrefixes = @(")
            .expect("脚本里没有 $RealBusPrefixes");
        let block = &script[start..];
        let end = block.find(')').unwrap_or(block.len());
        block[..end]
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                let inner = line.strip_prefix('\'')?.strip_suffix('\'')?;
                Some(inner.to_string())
            })
            .collect()
    }

    // 抠出 `$BudgetMs = @{ ... }` 里的键。
    fn budget_field_names(script: &str) -> Vec<String> {
        let start = script.find("$BudgetMs = @{").expect("脚本里没有 $BudgetMs");
        let block = &script[start..];
        let end = block.find('}').unwrap_or(block.len());
        block[..end]
            .lines()
            .filter_map(|line| {
                let (key, value) = line.trim().split_once('=')?;
                let key = key.trim();
                let value = value.trim();
                let bare = !key.is_empty()
                    && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
                    && value.chars().all(|c| c.is_ascii_digit());
                bare.then(|| key.to_string())
            })
            .collect()
    }

    #[test]
    fn fixture_has_no_serial_numbers_or_mac_addresses() {
        // 抹除是入库的前置条件（#3）。序列号没法通用识别，这里挡住最容易复发的：
        // MAC 形态，以及探针里的抹除占位符与敏感字段名。
        assert!(!FIXTURE.contains("已抹除"), "夹具里还留着抹除占位符");
        for sensitive in ["SerialNumber", "IdentifyingNumber", "MACAddress", "PNPDeviceID"] {
            assert!(!FIXTURE.contains(sensitive), "夹具里混进了 {sensitive}");
        }
        for line in lines() {
            assert!(!contains_mac(line), "夹具里混进了 MAC 地址：{line}");
        }
    }

    // 六个两字符十六进制组、以 `:` 或 `-` 分隔。`2026-09-28` 这类日期组不够六组，不会误伤。
    fn contains_mac(text: &str) -> bool {
        let chars: Vec<char> = text.chars().collect();
        const WINDOW: usize = 17;
        (0..chars.len().saturating_sub(WINDOW - 1)).any(|start| {
            let window = &chars[start..start + WINDOW];
            let separator = window[2];
            (separator == ':' || separator == '-')
                && window.iter().enumerate().all(|(index, character)| {
                    if index % 3 == 2 {
                        *character == separator
                    } else {
                        character.is_ascii_hexdigit()
                    }
                })
        })
    }
}
