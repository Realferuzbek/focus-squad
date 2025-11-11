import "react";

declare module "react" {
  interface IframeHTMLAttributes<T> {
    fetchPriority?: "high" | "low" | "auto";
    importance?: "high" | "low" | "auto";
  }
}
