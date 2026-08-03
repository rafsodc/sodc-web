import { Component, type ReactNode, type ErrorInfo } from "react";
import { Box } from "@mui/material";
import { reportError } from "../errors";
import FailureState from "./FailureState";

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
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
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
      this.setState({ hasError: false });
    }
  }

  private reset = () => {
    this.setState({ hasError: false });
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
            title={this.props.title}
            variant={this.props.variant}
            onRetry={this.reset}
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
