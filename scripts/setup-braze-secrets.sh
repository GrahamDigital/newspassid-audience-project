#!/bin/bash

# Setup script for Braze MAU Tracker secrets
# Usage: ./scripts/setup-braze-secrets.sh <stage>

set -e

STAGE=${1:-dev}

echo "Setting up Braze secrets for stage: $STAGE"

# Check if required environment variables are set
if [ -z "$BRAZE_API_KEY" ]; then
    echo "Error: BRAZE_API_KEY environment variable is not set"
    echo "Please set it with: export BRAZE_API_KEY=your_api_key"
    exit 1
fi

if [ -z "$BRAZE_ENDPOINT" ]; then
    echo "Error: BRAZE_ENDPOINT environment variable is not set"
    echo "Please set it with: export BRAZE_ENDPOINT=https://rest.iad-05.braze.com"
    exit 1
fi

echo "Setting BRAZE_API_KEY secret..."
sst secret set BRAZE_API_KEY "$BRAZE_API_KEY" --stage "$STAGE"

echo "Setting BRAZE_ENDPOINT secret..."
sst secret set BRAZE_ENDPOINT "$BRAZE_ENDPOINT" --stage "$STAGE"

echo "✅ Braze secrets have been set for stage: $STAGE"
echo ""
echo "You can now deploy the MAU tracker with:"
echo "sst deploy --stage $STAGE" 