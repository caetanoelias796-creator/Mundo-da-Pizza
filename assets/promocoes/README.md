# Mídias Promocionais do Totem de Autoatendimento — JC Food

Esta pasta foi criada para armazenar os vídeos e imagens promocionais que serão exibidos na **Tela de Espera (Painel de Publicidade)** do Totem / Tablet de autoatendimento.

## Formatos Suportados:
- **Vídeos**: `.mp4`, `.webm` (Codificação H.264/AAC recomendada para maior compatibilidade com navegadores).
- **Imagens / Artes**: `.png`, `.jpg`, `.jpeg`, `.webp`.

## Exemplo de Uso:
1. Coloque seu arquivo de vídeo nesta pasta com o nome, por exemplo, `video1.mp4`.
2. O caminho a ser utilizado no cadastro do painel será: `assets/promocoes/video1.mp4`.
3. Para imagens, você também pode usar qualquer imagem existente da pasta `assets/` (como `assets/gourmet_calabresa.png`, `assets/gourmet_margherita.png`, etc.) ou adicionar novas imagens aqui.

## Comportamento no Tablet:
- **Vídeos**: Reproduzem em loop de acordo com o carrossel, com áudio desligado (`muted`) e `autoplay` para seguir as políticas de segurança dos navegadores. Ao terminar o vídeo, avança automaticamente para o próximo conteúdo.
- **Imagens**: Ficam na tela pelo tempo configurado no painel administrativo (padrão de 8 segundos) e avançam suavemente com transição cross-fade.
- Ao tocar na tela, a publicidade é interrompida imediatamente e o cardápio touch-friendly é aberto para o cliente.
