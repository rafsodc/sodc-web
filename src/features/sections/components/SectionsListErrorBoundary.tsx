import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import PageHeader from "../../../shared/components/PageHeader";

interface Props {
  children: ReactNode;
  onBack: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionsListErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SectionsList error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <PageHeader title="Sections" onBack={this.props.onBack} />
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
