import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",               // ✅ 중요 (서브경로 아님)
  build: {
    outDir: "dist",        // 기본값
    sourcemap: false,      // 운영 권장
  },
});
