// Sample content for the public-web kit: XOSA (xosa.pl) — the owner's own
// studio, four works with real renders. Names, clients and descriptions follow
// the portfolio pages; pictures live in assets/xosa/.
(function () {
  const X = "../../assets/xosa/";
  window.A3D_DATA = {
    profile: {
      displayName: "XOSA Architekci",
      handle: "xosa",
      avatarUrl: X + "xosa-logo.png",
      cover: X + "cover-marina-bw.jpg",
      headline: "Autorska pracownia architektoniczna",
      bio: "Pełna obsługa inwestora: analizy planowanych inwestycji, konsultacje projektowe, koncepcje i projekty.\nDomy, hotele, biura, dworce — od Lisiego Ogona po Gdańsk.",
      places: ["Bydgoszcz", "Kujawsko-pomorskie", "Polska"],
    },
    works: [
      { id: "w1", slug: "hnb-bialobrzegi", name: "HNB — Hotel i apartamenty Lake View, Białobrzegi", investor: "Nordic Development S.A.", developer: "", description: "Koncepcja zabudowy terenu nad Zalewem Zegrzyńskim. Przy zalewie zespół hotelowo-konferencyjny z prywatną mariną i plażą; w głębi, w lesie, apartamentowce wpisane w istniejące zadrzewienie, każdy z własnym basenem i małym SPA. Elewacje: okładziny kamienne i drewno. Koncepcja 2016, projekt XOSA, GDA, PNB.", cover: X + "hnb-apartamenty.jpg", thumbs: [X + "hnb-hotel-basen.jpg", X + "hnb-marina.jpg"], pictures: [X + "hnb-apartamenty.jpg", X + "hnb-hotel-basen.jpg", X + "hnb-marina.jpg", X + "hnb-wnetrze-1.jpg", X + "hnb-wnetrze-2.jpg", X + "hnb-plan.jpg"], orbit: { poster: X + "hnb-hotel-basen.jpg", autorotate: true, cues: ["Marina", "Basen", "Las"] }, layout: "cover-thumbs" },
      { id: "w2", slug: "dlo-lisi-ogon", name: "DLO — Dom z widokiem na łowisko, Lisi Ogon", investor: "Prywatny", developer: "", description: "Dom jednorodzinny na bazie kontenerów morskich, ukształtowany na skarpie tak, by obserwować szeroki plan łowisk. Część dzienna na dwóch kondygnacjach; salon z widokiem w promieniu 360 stopni. Elewacje z blachy pełnej i perforowanej, na poziomie 0 basen. Koncepcja i projekt 2016.", cover: X + "dlo-front.png", thumbs: [], pictures: [X + "dlo-front.png"], orbit: null, layout: "cover-text" },
      { id: "w3", slug: "mvg-gniezno", name: "MVG — Budynek mieszkalny, Gniezno", investor: "", developer: "", description: "Budynek wielorodzinny w centrum Gniezna. Modułowa, biała elewacja z loggiami, tarasy na dachu z widokiem na katedrę.", cover: X + "mvg-front.jpg", thumbs: [X + "mvg-elewacja.jpg", X + "mvg-taras.jpg"], pictures: [X + "mvg-front.jpg", X + "mvg-elewacja.jpg", X + "mvg-taras.jpg", X + "mvg-schematy.jpg"], orbit: null, layout: "cover" },
      { id: "w4", slug: "dpb-bydgoszcz", name: "DPB — Dworzec PKP, Bydgoszcz", investor: "", developer: "", description: "Koncepcja dworca kolejowego w Bydgoszczy: szklana bryła nad peronami, przedpole z torowiskiem tramwajowym.", cover: X + "dpb-front.jpg", thumbs: [X + "dpb-ulica.jpg"], pictures: [X + "dpb-front.jpg", X + "dpb-ulica.jpg"], orbit: null, layout: "cover-thumbs" },
    ],
  };
})();
