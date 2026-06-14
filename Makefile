# Makefile for Nieuwburg Blitz Development

.PHONY: all build-frontend run-backend build-run

# Default target
all: build-run

# Build the React frontend
build-frontend:
	@echo "--- Building React Admin Frontend ---"
	@cd nieuwburg/admin-frontend && npm run build

# Run the Flask backend server
run-backend:
	@echo "--- Starting Flask Backend (ensure venv is active) ---"
	@python run.py

# Build frontend THEN run backend
build-run: build-frontend run-backend