FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		git \
		sudo \
	&& rm -rf /var/lib/apt/lists/*

USER ubuntu
WORKDIR /home/ubuntu

ENV BUN_INSTALL="/home/ubuntu/.bun"
ENV PATH="/home/ubuntu/.bun/bin:${PATH}"

RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.3.14
