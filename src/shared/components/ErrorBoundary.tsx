import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import PageHeader from "./PageHeader";
import "./PageContainer.css";
import { colors } from "../../config/colors";

interface Props {
  children: ReactNode;
  title: string;
  onBack: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box className="page-container" sx={{ backgroundColor: colors.background, minHeight: "100vh" }}>
          <PageHeader title={this.props.title} onBack={this.props.onBack} />
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}
