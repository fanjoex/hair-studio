# Deploy: Vercel (frontend) + Render (backend) + MongoDB Atlas

Sua arquitetura final:

```
[Cliente browser] ──▶ [Vercel: React SPA] ──XHR (cookies)──▶ [Render: FastAPI] ──▶ [MongoDB Atlas]
```

---

## 1. MongoDB Atlas (já configurado)

Você já tem um cluster no Atlas. Confirme estes pontos:

1. **Network Access** → adicionar `0.0.0.0/0` (Render usa IPs dinâmicos no plano free)
   - Atlas → Network Access → Add IP → Allow Access from Anywhere
2. **Database User** → confirme que o usuário tem permissão `readWrite` no DB `hair_beard_studio`
3. **Connection String** → copie a connection string atual (já está no `backend/.env`):
   ```
   mongodb+srv://admin:barber123@cluster0.gbdc9ox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

---

## 2. Backend no Render

### Opção A — Blueprint (recomendado)

1. **Suba o projeto pro GitHub** (se ainda não estiver). Garanta que `backend/.env` está no `.gitignore`.
2. Acesse https://dashboard.render.com/blueprints
3. **New Blueprint Instance** → conecte seu repo
4. Render detecta o `backend/render.yaml` e cria o serviço automaticamente
5. Em **Environment Variables** preencha (algumas estão marcadas `sync: false`, precisam ser setadas manualmente):
   - `MONGO_URL` = sua string do Atlas
   - `EMERGENT_LLM_KEY` = sua chave do Gemini (`AIzaSy...`)
   - `CORS_ORIGINS` = (deixe em branco por enquanto, voltamos depois)
   - `ADMIN_PASSWORD` = senha forte para o admin master
6. **Deploy** → Render builda e sobe. Anote a URL (ex: `https://hair-beard-studio-api.onrender.com`)

### Opção B — Manual

1. Render Dashboard → New + → Web Service
2. Connect repo, escolha branch
3. **Root Directory:** `backend`
4. **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
5. **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. **Environment Variables:** as mesmas listadas acima + `ENVIRONMENT=production`, `DB_NAME=hair_beard_studio`, `JWT_SECRET=<gere com `openssl rand -hex 32`>`

### Após o deploy do backend

Teste o healthcheck:
```
https://SEU-BACKEND.onrender.com/api/health
# deve retornar { "status": "ok", "db": true, "env": "production" }
```

---

## 3. Frontend no Vercel

1. Vercel Dashboard → **New Project** → importe seu repo
2. **Root Directory:** `frontend`
3. Vercel detecta `vercel.json` e usa as configs corretas
4. **Environment Variables:**
   - `REACT_APP_BACKEND_URL` = `https://SEU-BACKEND.onrender.com` (a URL do passo 2)
5. **Deploy**

Anote a URL (ex: `https://seu-app.vercel.app`).

---

## 4. Conectar os dois (CORS)

Volte no Render → Environment do seu serviço backend → edite:
- `CORS_ORIGINS` = `https://seu-app.vercel.app,https://seu-app-*.vercel.app`

Salve. O Render reinicia o backend automaticamente.

> Cookies cross-site funcionam porque setei `secure=True, samesite=None` no backend quando `ENVIRONMENT=production`.

---

## 5. Seed do banco

Apenas na primeira vez, rode o seed pra criar admin master e dono de barbearia exemplo:

**Local apontando pro Atlas:**
```powershell
cd backend
python seed_master.py
python seed_barbershop.py
python seed_styles_catalog.py
```

Ou rode via "Render Shell" (no dashboard do serviço → Shell).

---

## 6. Domínio customizado (opcional)

- **Vercel:** Settings → Domains → adicione seu domínio
- **Render:** Settings → Custom Domains → adicione subdomínio (ex: `api.seudominio.com`)
- Atualize `REACT_APP_BACKEND_URL` no Vercel e `CORS_ORIGINS` no Render
- Re-deploy do frontend

---

## Troubleshooting

| Sintoma | Causa | Solução |
|---|---|---|
| Login funciona mas `/auth/me` retorna 401 no Vercel | Cookies não estão sendo enviados | Verificar que `ENVIRONMENT=production` no Render. Backend e frontend devem estar em HTTPS. |
| CORS error no console | `CORS_ORIGINS` errado | Adicionar a URL exata do Vercel (com `https://`, sem barra final) |
| Backend lento na 1ª req | Render free tier hiberna após 15min | Esperado. Considere plano pago ou ping periódico. |
| Imagem do estilo não carrega | URL aponta pro localhost | Verifique `REACT_APP_BACKEND_URL` no Vercel |
| Cliente não loga | Mongo bloqueado | Atlas → Network Access → `0.0.0.0/0` |
