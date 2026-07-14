import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] render failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[240px] p-4 flex items-center justify-center">
          <div className="liquid-glass rounded-2xl p-6 text-center space-y-2 max-w-md">
            <AlertTriangle className="w-8 h-8 text-primary mx-auto" />
            <h2 className="text-base font-black">
              {this.props.fallbackTitle || "Something needs a refresh"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {this.props.fallbackMessage || "Please refresh this page once. If it repeats, we will see the exact error here instead of a blank screen."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}