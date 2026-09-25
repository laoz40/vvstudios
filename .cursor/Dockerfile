FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		git \
		sudo \
		unzip \
	&& rm -rf /var/lib/apt/lists/* \
	&& curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.14 \
	&& ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
	&& ln -sf /root/.bun/bin/bunx /usr/local/bin/bunx

WORKDIR /home/ubuntu
