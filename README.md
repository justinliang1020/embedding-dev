## embedding-dev

Compare text embedding models from Google, OpenAI, and Cohere.

## Getting started

1. Run a [local version of chroma](https://docs.trychroma.com/deployment#simple-aws-deployment) with Docker
```bash
git clone https://github.com/chroma-core/chroma.git
cd chroma
docker-compose up -d --build
```
2. copy .env variables from .env.example
```bash
cp .env.example .env
```

3. Run app
```bash
npm run dev
```

4. Visit [localhost:3000](localhost:3000)

