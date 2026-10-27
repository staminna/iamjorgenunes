#!/usr/bin/env bash
# Apaga o cluster local e liberta a RAM. A imagem Docker local fica.
set -euo pipefail
kind delete cluster --name iamjorgenunes
