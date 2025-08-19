# Supabase Local Development with Podman

This guide explains how to set up Supabase locally using Podman instead of Docker Desktop.

## Prerequisites

- Podman installed on your system
- Podman-compose or podman-docker compatibility layer
- Node.js and npm installed
- Supabase CLI (already installed via npm)

## Step 1: Configure Podman for Docker Compatibility

### Option A: Using podman-docker (Recommended)

Install the podman-docker package which provides Docker CLI compatibility:

```bash
# On macOS with Homebrew
brew install podman-docker

# On Linux
sudo dnf install podman-docker  # Fedora
sudo apt install podman-docker  # Ubuntu/Debian
```

### Option B: Using Docker Emulation Mode

Create an alias for docker commands:

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
alias docker=podman
```

## Step 2: Configure Podman Socket

Supabase CLI expects a Docker socket. We need to create a Podman socket that mimics Docker's behavior:

```bash
# Start the Podman socket service
podman system service --time=0 unix:///var/run/docker.sock &

# Or for user-level socket (recommended for macOS)
podman system service --time=0 unix://$HOME/.local/share/containers/podman/machine/podman.sock &
```

## Step 3: Set Environment Variables

Create or update your `.env.local` file with Podman-specific settings:

```bash
# Docker socket path for Podman
DOCKER_HOST=unix://$HOME/.local/share/containers/podman/machine/podman.sock

# Optional: Force Supabase to use Podman
SUPABASE_DOCKER_COMMAND=podman
```

## Step 4: Initialize Podman Machine (macOS only)

If you're on macOS, you need to initialize and start a Podman machine:

```bash
# Initialize Podman machine
podman machine init

# Start Podman machine
podman machine start

# Set the socket path
export DOCKER_HOST='unix:///Users/akul/.local/share/containers/podman/machine/podman.sock'
```

## Step 5: Verify Podman Setup

```bash
# Check Podman is running
podman info

# Test Docker compatibility
podman ps
```

## Step 6: Link Supabase Project

```bash
# Link to your Supabase project
npm run supabase:link
```

## Step 7: Start Supabase with Podman

```bash
# Start Supabase services
npm run supabase:start
```

## Troubleshooting

### Issue: "Cannot connect to the Docker daemon"

Solution:
```bash
# Ensure Podman socket is running
systemctl --user start podman.socket  # Linux
podman machine start                   # macOS
```

### Issue: "Permission denied" errors

Solution:
```bash
# Run Podman in rootless mode (recommended)
podman unshare

# Or adjust socket permissions
sudo chmod 666 /var/run/docker.sock
```

### Issue: Port conflicts

Solution:
```bash
# Check for conflicting services
podman ps -a
podman port

# Stop conflicting containers
podman stop <container_id>
```

## Useful Commands

```bash
# Check Supabase status
npm run supabase:status

# View logs
npx supabase db logs

# Reset database
npm run supabase:reset

# Stop services
npm run supabase:stop
```

## Project Configuration

Your project is already configured with:
- Project ID: lwdjpwkrvafwrlizcroj
- Migration files in: supabase/migrations/
- Supabase config in: supabase/config.toml

## Next Steps

1. Run the setup script: `./scripts/setup-podman.sh`
2. Start Supabase: `npm run supabase:start`
3. Access Supabase Studio at: http://localhost:54323
4. Your local API URL will be: http://localhost:54321

## Additional Resources

- [Podman Documentation](https://docs.podman.io/)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Podman Docker Compatibility](https://docs.podman.io/en/latest/markdown/podman-docker.1.html)