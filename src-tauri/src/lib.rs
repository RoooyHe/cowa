use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// 采集器 → UI 的契约，与 src/hardware/contract.ts 一一对应。
// 契约只表达「到了什么」；`骨架` 由 UI 侧从「还没收到」推出来。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SnapshotValue {
    Value { text: String },
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
