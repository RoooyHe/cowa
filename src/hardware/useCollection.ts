import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { FieldUpdate } from "./contract";
import { applyFieldUpdate, closeStream, initialStreamState, type StreamState } from "./stream";

// 唯一碰 Tauri 的地方。组件只收 StreamState，所以组件测试里连 Tauri 都不存在。
// 见 issue #1「唯一的那条缝」：注入点在最高处。
export function useCollection(): StreamState {
  const [state, setState] = useState<StreamState>(initialStreamState);

  useEffect(() => {
    let cancelled = false;
    const unlisten: Array<() => void> = [];

    void (async () => {
      try {
        // 先挂监听，再让 Rust 起进程——否则最早的字段可能落在没人听的空档里。
        const [offUpdate, offComplete] = await Promise.all([
          listen<FieldUpdate>("field-update", (event) => {
            setState((current) => applyFieldUpdate(current, event.payload));
          }),
          listen("collection-complete", () => {
            setState(closeStream);
          }),
        ]);

        if (cancelled) {
          offUpdate();
          offComplete();
          return;
        }
        unlisten.push(offUpdate, offComplete);

        // Rust 侧保证一个进程只 spawn 一次（开发模式的 StrictMode 会调两次）。
        await invoke("collect");
      } catch (error) {
        // 采集根本起不来时，也别把整屏永远留在骨架上。
        console.error("采集未能启动", error);
        if (!cancelled) setState(closeStream);
      }
    })();

    return () => {
      cancelled = true;
      unlisten.forEach((off) => off());
    };
  }, []);

  return state;
}
