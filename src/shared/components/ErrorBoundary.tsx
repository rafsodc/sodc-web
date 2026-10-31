import { Component, type ReactNode, type ErrorInfo } from "react";
import { Box } from "@mui/material";
import { reportError } from "../errors";
import FailureState from "./FailureState";
import { isModuleLoadError } from "../appShell/moduleLoadRecovery";

interface Props {
  children: ReactNode;
  title?: string;
  resetKey?: string;
  variant?: "inline" | "page";
  onBack?: () => void;
  onHome?: () => void;
  onReload?: () => void;
}

interface State {
  hasError: boolean;
  moduleLoadError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, moduleLoadError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, moduleLoadError: isModuleLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError("render-boundary", error, {
      componentStack: errorInfo.componentStack ?? "",
    });
  }

  componentDidUpdate(previousProps: Props) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, moduleLoadError: false });
    }
  }

  private reset = () => {
    this.setState({ hasError: false, moduleLoadError: false });
  };

  private reload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ width: "100%" }}>
          <FailureState
            title={this.state.moduleLoadError ? "This page couldn’t load" : this.props.title}
            message={this.state.moduleLoadError
              ? "The site may have been updated, or your connection may have been interrupted. Reload to get the current page. Unsaved changes may be lost; check any recent save before trying it again."
              : undefined}
            variant={this.props.variant}
            onRetry={this.state.moduleLoadError ? undefined : this.reset}
            onReload={this.reload}
            onBack={this.props.onBack}
            onHome={this.props.onHome}
          />
        </Box>
      );
    }

    return this.props.children;
  }
}
