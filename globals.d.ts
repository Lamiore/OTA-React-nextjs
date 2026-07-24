// Ambient decl so `tsc --noEmit` accepts side-effect CSS imports (Next handles them at build/dev).
declare module '*.css';
