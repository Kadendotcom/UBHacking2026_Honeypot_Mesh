#!/usr/bin/env bash

ssh-keygen -q -N "" -t rsa -b 2048 -f keys/server_rsa -C "server test RSA 2048 key"
ssh-keygen -q -N "" -t rsa -b 2048 -f keys/client_rsa -C "client test RSA 2048 key"

ssh-keygen -q -N "" -t ecdsa -f keys/server_ecdsa -C "server test ECDSA key"
ssh-keygen -q -N "" -t ecdsa -f keys/client_ecdsa -C "client test ECDSA key"

ssh-keygen -q -N "" -t ed25519 -f keys/server_ed25519 -C "server test Ed25519 key"
ssh-keygen -q -N "" -t ed25519 -f keys/client_ed25519 -C "client test Ed25519 key"