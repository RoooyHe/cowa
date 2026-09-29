import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library 只在全局 afterEach 存在时才自动清理；这里显式挂上，
// 免得两个测试的 DOM 互相污染。
afterEach(cleanup);
