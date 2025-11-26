import type { ComponentType } from "react";
import { cssInterop } from "nativewind";

type AnyProps = Record<string, unknown>;

export function styled<TProps extends AnyProps>(Component: ComponentType<TProps>) {
  return cssInterop(Component as ComponentType<any>, {
    className: "style",
  }) as ComponentType<TProps>;
}
