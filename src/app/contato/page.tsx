export const metadata = {
  title: 'Contato',
  description: 'Fale com a Conexao Perfumaria pelo WhatsApp ou Instagram.',
};

export default function ContactPage() {
  return (
    <section className="contact-page">
      <div>
        <p className="eyebrow">Canal direto</p>
        <h1>Se o checkout caiu, a conversa segura a venda.</h1>
        <p>
          Chame a equipe para confirmar disponibilidade, frete, PIX e prazo. A
          loja esta em modo independente para voltar a vender sem travar.
        </p>
      </div>
      <div className="contact-card">
        <a
          className="button full"
          href="https://wa.me/555521981024555"
          target="_blank"
        >
          WhatsApp
        </a>
        <a
          className="button ghost full"
          href="https://instagram.com/conexao_perfumaria"
          target="_blank"
        >
          Instagram
        </a>
        <a className="button ghost full" href="tel:+5521981024555">
          Telefone
        </a>
      </div>
    </section>
  );
}
