export const metadata = {
  title: 'Contato',
  description: 'Fale com a Conexão Perfumaria pelo WhatsApp ou Instagram.',
};

export default function ContactPage() {
  return (
    <section className="contact-page">
      <div>
        <p className="eyebrow">Atendimento VIP</p>
        <h1>Compre com ajuda de quem entende de perfume.</h1>
        <p>
          Tire dúvidas, confirme disponibilidade e receba indicações para
          acertar na fragrância ou no presente.
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
