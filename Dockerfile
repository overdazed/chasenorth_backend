FROM node:20-bookworm

# Install Python3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Set Python path for the invoice service
ENV PYTHON_PATH=python3

# Railway exposes port 8080 by default
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]
