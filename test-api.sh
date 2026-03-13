#!/bin/bash

# Script para testar endpoints do Baileys Server no Render
# Use: bash test-api.sh

BASE_URL="https://api-1-ft6j.onrender.com"
SECRET="gestor-disparo-secret"

echo "=== Testando Baileys Server API ==="
echo "URL: $BASE_URL"
echo ""

# Test 1: Health check
echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq . || echo "❌ Falhou"
echo ""

# Test 2: Status (sem parâmetros)
echo "2. Status Geral:"
curl -s "$BASE_URL/api/status" | jq . || echo "❌ Falhou"
echo ""

# Test 3: Connect (criar nova sessão)
echo "3. Conectar Nova Sessão:"
curl -s -X POST "$BASE_URL/api/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "phone_number": "5511987654321",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }' | jq .
echo ""

# Test 4: Send message (teste com números fictícios)
echo "4. Enviar Mensagem (teste):"
curl -s -X POST "$BASE_URL/api/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "phone": "5511987654321",
    "to": "5511912345678",
    "message": "Teste"
  }' | jq .
echo ""

echo "=== Testes Completos ==="
