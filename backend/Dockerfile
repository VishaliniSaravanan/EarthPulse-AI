FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

# ffmpeg is required for extracting audio tracks from videos.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 5001

# Render injects $PORT; app.py binds to it for the health checks / external traffic.
CMD ["sh", "-c", "python app.py"]

