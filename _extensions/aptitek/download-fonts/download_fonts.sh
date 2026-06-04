#!/bin/bash
set -e

FONT_URL="https://github.com/arrowtype/recursive/releases/download/v1.085/ArrowType-Recursive-1.085.zip"

# Use QUARTO_PROJECT_DIR if set, otherwise use current directory
if [ -n "$QUARTO_PROJECT_DIR" ]; then
  BASE_DIR="$QUARTO_PROJECT_DIR"
else
  BASE_DIR="."
fi

FONT_DIR="$BASE_DIR/fonts"
FONT_FILE="$FONT_DIR/Recursive_VF_1.085.ttf"

if [ ! -f "$FONT_FILE" ]; then
  echo "Downloading Recursive font to $FONT_DIR..."
  mkdir -p "$FONT_DIR"
  curl -L -s -o recursive.zip "$FONT_URL"
  unzip -q -j -o recursive.zip "ArrowType-Recursive-1.085/Recursive_Desktop/Recursive_VF_1.085.ttf" -d "$FONT_DIR/"
  rm recursive.zip
  
  # Install locally to bypass Quarto Typst cross-folder bugs
  if [ -d "$HOME/.local/share/fonts" ] || [ "$(uname)" = "Linux" ]; then
    mkdir -p "$HOME/.local/share/fonts/recursive"
    cp "$FONT_FILE" "$HOME/.local/share/fonts/recursive/"
    if command -v fc-cache >/dev/null 2>&1; then
      fc-cache -f "$HOME/.local/share/fonts/recursive"
    fi
  fi
  
  echo "Font downloaded and installed."
else
  echo "Recursive font already installed in $FONT_DIR."
fi
