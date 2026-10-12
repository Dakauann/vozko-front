import type { Brief } from "./model";
import { extendedBriefs } from "./references-extended";
import { sotaBriefs } from "./references-sota";

const FEED = { kind: "image", width: 1080, height: 1350 } as const;

export function briefs(): Brief[] {
  return [
    { id: "menu", title: "Cardápio de hamburgueria", open: FEED, text: "Cardápio de hamburgueria com 8 itens e preços: 5 burgers com uma linha de descrição cada e 3 bebidas. Nome da casa: Brasa & Pão. Visual escuro e quente, com o pedido pelo WhatsApp (11) 4002-8922 no rodapé." },
    { id: "event", title: "Pôster de evento com sombras", open: FEED, text: "Pôster do festival de música eletrônica PULSO, 14 de dezembro, 22h, Arena Lagoa, ingressos em pulso.app. Quero profundidade dramática: sombras em camadas, coloridas e coerentes com uma única luz." },
    { id: "product", title: "Card de venda com preço", open: { kind: "image", width: 1080, height: 1080 }, text: "Card de venda de ingresso para o Le Mans em Interlagos: R$ 1.000, 29/10, das 14h às 18h. Escuro, com neon e fumaça, preço em destaque e botão Comprar ingresso." },
    { id: "feed", title: "Anúncio de feed", open: FEED, text: "Anúncio de feed para a pizzaria Forno da Vila: pizza grande + refri 2 L por R$ 59,90, entrega grátis no bairro até 22h, chamada Peça pelo WhatsApp." },
    { id: "story", title: "Anúncio de story 9:16", open: { kind: "image", width: 1080, height: 1920 }, text: "Story de anúncio para a liquida de inverno de uma loja de roupas: até 60% off em casacos e malhas, só até domingo, chamada Toque e garanta o seu. Respeite as zonas seguras do story." },
    { id: "ribbons", title: "Faixas arredondadas e fitas", open: FEED, text: "Arte de aniversário de 10 anos da Doceria Mel com faixas arredondadas cruzando a peça e uma fita de laço com as pontas dobradas. Festa em 25/10 a partir das 15h, Rua das Flores, 120, entrada livre." },
    { id: "sports", title: "Peça esportiva diagonal", open: FEED, text: "Peça da grande final do campeonato metropolitano de basquete: Tubarões x Falcões, sábado às 16h, Ginásio Central. Composição diagonal com energia, faixas inclinadas e linhas de velocidade." },
    { id: "luxury", title: "Peça minimalista de luxo", open: FEED, text: "Peça minimalista de luxo para a joalheria Maison Élan apresentando a coleção Aurora, joias em ouro 18k. Muito respiro, tipografia serifada elegante e detalhes finos em dourado." },
    { id: "infographic", title: "Infográfico com gráfico", open: FEED, text: "Infográfico das vendas do 1º semestre de uma loja online: faturamento de R$ 482 mil, +38% contra 2025, 12,4 mil pedidos. Gráfico de barras por mês (jan 52, fev 61, mar 70, abr 83, mai 98, jun 118, em milhares de reais) e a divisão por canal: site 62%, app 28%, marketplace 10%." },
    { id: "rpg", title: "Ficha de personagem de RPG", open: FEED, text: "Ficha de personagem de RPG para Lyra Ventoleve, elfa arqueira de nível 7: atributos FOR 12, DES 18, CON 14, INT 13, SAB 15, CAR 10; vida 42 de 56; mana 18 de 30; perícias furtividade +8, percepção +7, sobrevivência +6, acrobacia +7; equipamento arco longo élfico e aljava com 24 flechas. Estética de pergaminho." },
    { id: "promo", title: "Vídeo curto promocional", open: { kind: "video", aspect: "story" }, text: "Vídeo curto de 6 segundos em 9:16 lançando o Café Gelado, novo no cardápio, por R$ 14,90, com a chamada Peça no app. Movimento com energia e entradas bem marcadas." },
    ...extendedBriefs(),
    ...sotaBriefs(),
  ];
}
