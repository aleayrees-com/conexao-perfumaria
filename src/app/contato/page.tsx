export const metadata = {
  title: 'Contato',
  description: 'Fale com a Conexão Perfumaria pelo WhatsApp ou Instagram.',
};

const embeddedStoreMapUrl =
  'https://www.google.com/maps?output=embed&cid=17040870420316839582';
const storeGoogleMapsUrl =
  'https://www.google.com/maps/place/Conex%C3%A3o+Perfumaria/data=!4m2!3m1!1s0x0:0xec7d555c62725e9e?sa=X&ved=1t:2428&ictx=111';

export default function ContactPage() {
  return (
    <>
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
      <section
        aria-labelledby="contact-location-title"
        className="contact-location"
        id="localizacao"
      >
        <div className="contact-location-copy">
          <p className="eyebrow">Loja física</p>
          <h2 id="contact-location-title">Encontre a Conexão Perfumaria.</h2>
          <p>Veja a localização da loja e planeje sua visita pelo mapa.</p>
        </div>
        <div className="contact-map-panel">
          <iframe
            className="contact-map-frame"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embeddedStoreMapUrl}
            title="Localização da Conexão Perfumaria no Google Maps"
          />
          <a
            className="button ghost contact-map-link"
            href={storeGoogleMapsUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir no Google Maps
          </a>
        </div>
      </section>
    </>
  );
}
