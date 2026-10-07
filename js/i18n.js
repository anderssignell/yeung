// Språkval: svenska, engelska och traditionell kinesiska (繁體).
//
// Två slags texter:
//  * Gränssnittet (knappar, rubriker, förklaringar) – tabellen STRINGS nedan.
//    Den publiceras okrypterad och får därför aldrig innehålla namn.
//  * Innehållet (tidslinje, seder, platser, familjens anteckningar och de
//    automatiska förklaringarna i trädet) är svensk text i data/*.json. Dess
//    översättningar ligger i data/translations_<språk>.json (krypteras som all
//    släktdata) och slås upp med I18n.dt(svensk text). Saknas en översättning
//    visas svenskan. Se tools/translations.py.
//
// Byte av språk sänder händelsen 'langchange'; varje vy ritar då om sig.
window.I18n = (function () {
  const STORE_KEY = 'yeung-lang';
  const LANGS = [
    { code: 'sv', html: 'sv', locale: 'sv-SE', short: 'SV', name: 'Svenska' },
    { code: 'en', html: 'en', locale: 'en-GB', short: 'EN', name: 'English' },
    { code: 'zh', html: 'zh-Hant', locale: 'zh-Hant-HK', short: '中', name: '繁體中文' },
  ];

  // Värden kan vara en sträng eller { one, other } för singular/plural.
  // {namn} ersätts med värden ur vars.
  const STRINGS = {
    sv: {
      page_title: 'Beishan Yang — Familjens resa',
      brand_sub: 'Familjens resa genom åtta hundra år',
      updated: 'Senast uppdaterad: {date}',
      draft_note: '',
      lang_label: 'Språk',
      views: 'Visningar',
      tab_tree: 'Släktträd',
      tab_timeline: 'Tidslinje',
      tab_map: 'Karta',
      tab_customs: 'Seder & regler',
      tab_clan: 'Hela klanen',
      lock_now: 'Lås sajten',
      lock_now_title: 'Lås sajten (glöm lösenordet på den här enheten)',
      admin_review: 'Granska bidrag',
      admin_review_title: 'Öppna granskningssidan för bidrag från släkten',
      admin_footer: 'Administratör',
      theme: 'Byt färgtema',
      close: 'Stäng',

      lock_lead: 'Familjens släktsajt är skyddad med lösenord. Fråga Anders om du behöver det.',
      lock_password: 'Lösenord',
      lock_remember: 'Kom ihåg mig på den här enheten',
      lock_submit: 'Lås upp',
      lock_busy: 'Låser upp …',
      lock_wrong: 'Fel lösenord. Kontrollera stora och små bokstäver och försök igen.',

      legend_confirmed: 'Bekräftat i 1857 års tryckta bok',
      legend_direct: 'Direkt linje till grenen i Sverige',
      legend_mamma: 'Grenen som flyttade till Sverige',
      legend_uncertain: 'Endast osäker handskriven lapp',
      legend_gap: 'Okänt mellanled',
      legend_reconstructed: 'Rekonstruerad koppling',
      legend_uncertain_link: 'Osäker / okänd koppling',
      legend_howto: 'Klicka på en person för att fälla ut grenen · ⓘ visar detaljer',
      legend_note: '† = kantonesiskt namn genererat (Jyutping), ej källbelagt',
      tree_search: 'Sök bland hela klanen (pinyin, kantonesiska eller tecken) …',
      tree_search_label: 'Sök person i släktträdet',
      zoom_in: 'Zooma in',
      zoom_out: 'Zooma ut',
      zoom_reset: 'Återställ vy',
      expand_family: 'Expandera familjegrenen',
      expand_family_title: 'Återställ till familjens gren utfälld',
      expand_to_mamma: 'Ner till grenen i Sverige',
      find_mamma: 'Hitta grenen i Sverige',
      find_mamma_title: 'Flytta vyn tillbaka till grenen i Sverige (inget fälls ihop)',
      expand_to_mamma_title: 'Familjens gren utfälld ner till generationen som flyttade till Sverige – barnen och barnbarnen döljs',

      tl_heading: 'Åtta hundra år, i korthet',
      tl_intro: 'Från stamfaderns flytt från Nánxióng 1237, genom Qing-dynastins kustförbud, till den tryckta släktboken 1857 och familjens egen resa till Hongkong och Sverige.',
      tl_namenote: 'Personnamn anges med kantonesiskt uttal. † = namnet är genererat från tecknen (Jyutping) och inte källbelagt i familjens egna dokument.',
      tl_in_tree: 'I släktträdet:',
      tl_on_map: 'visa på karta',
      approx: 'cirka',

      map_heading: 'Platser i familjens historia',
      map_hint: 'Klicka på en markering för att läsa mer. Linjen visar den ungefärliga migrationsordningen.',
      map_offline: 'Förenklad karta visas (kartservern gick inte att nå).',
      map_offline_mode: 'Förenklad karta (inbyggd i sajten, utan extern kartserver).',
      layer_family: 'Familjens resa',
      layer_villages: 'Grannbyar & giftermål',
      layer_abroad: 'Utvandring',
      map_sec_family: 'Familjens resa',
      map_sec_abroad: 'Utvandring på 1800-talet',
      map_hint_abroad: 'Klanmedlemmar som enligt boken reste eller dog utomlands.',
      map_sec_villages: 'Grannbyar och giftermål',
      map_hint_villages: 'Byar som nämns i släktboken, oftast som hustrurnas hemby eller dit döttrarna gifte sig. Siffran är antalet personer i boken som kopplas till byn.',
      approx_pos: 'Ungefärlig position',
      unknown_pos: 'Läget är okänt – visas inte på kartan',
      source_china_daily: 'Källa: China Daily',
      popup_click: 'Klicka på en person för att visa hen i släktträdet. Uppgifterna är hämtade ur 1857 års släktbok.',
      count_wife: { one: '{n} hustru härifrån', other: '{n} hustrur härifrån' },
      count_daughter: { one: '{n} dotter gifte in sig här', other: '{n} döttrar gifte in sig här' },
      count_abroad: { one: '{n} klanmedlem reste eller dog här', other: '{n} klanmedlemmar reste eller dog här' },
      count_mention: 'nämns {n} gånger till',
      rel_wife: 'hustru härifrån',
      rel_daughter: 'dotter gift hit',
      rel_abroad: 'reste/dog här',
      rel_mention: 'nämns',

      customs_heading: 'Seder, regler och sorgeritual',

      clan_heading: 'Hela Beishan Yang-klanen',
      clan_intro: 'Den tryckta släktboken från 1857 dokumenterar inte bara vår egen gren, utan tusentals medlemmar av hela klanen genom 22 generationer, i både Äldsta grenen (長房) och Andra grenen (次房). Här är samtliga tio volymer sammanställda till en sökbar databas – samma personer finns också i Släktträd-fliken, där varje gren kan fällas ut.',
      clan_search: 'Sök namn (pinyin eller kinesiska tecken) …',
      clan_branches: 'Största grenarna',
      clan_stats: '{records} poster ur alla tio volymer. Efter att dubbletter (samma person registrerad i både släktschema och biografidel) slagits ihop blir det {persons} personer inklusive familjens egen moderna gren. {connected} av dem hänger ihop i en obruten kedja från Sìrú-gong; resten ligger i grenar vars koppling uppåt inte framgår av källan. Kantonesiska namn märkta † / "Jyutping, ej källbelagt" är mekaniskt genererade från tecknen – använd Pinyin för säkra referenser till 1857 års bok.',
      clan_more: '+ {n} mindre grenar och enskilda poster (sök på namn ovan för att hitta dem).',
      clan_root_tag: 'i obruten kedja från stamfadern',
      link_up_unknown: 'koppling uppåt okänd',
      descendants: { one: '{n} ättling', other: '{n} ättlingar' },
      no_hits: 'Inga träffar.',
      search_father: 'far {name}',
      search_link_unknown: 'koppling okänd',

      gen_short: 'Gen. {g}',
      gen_short_est: 'Gen. ≈{g}',
      gen_long: 'Generation {g} av klanen',
      gen_long_est: 'Generation ≈{g} av klanen',
      branch_eldest: 'Äldsta grenen (長房)',
      branch_second: 'Andra grenen (次房)',
      heir_no_heir: 'Ingen arvinge (無嗣)',
      heir_adopted_out: 'Bortadopterad (出嗣)',
      heir_adopted_in: 'Adopterad in (嗣子)',
      conf_confirmed: 'Bekräftat i 1857 års tryckta bok',
      conf_direct: 'Direkt linje till grenen i Sverige',
      conf_documented: 'Familjens egen dokumentation',
      conf_uncertain: 'Endast osäker handskriven lapp',
      conf_gap: 'Odokumenterat mellanled i källan',
      link_reconstructed: 'Rekonstruerad koppling',
      link_ambiguous: 'Osäker koppling – namnlikar',
      link_gap: 'Koppling uppåt okänd',
      link_family: 'Koppling enligt familjens dokument',
      badge_mamma: 'Flyttade till Sverige',
      badge_you: 'Har gjort sajten',
      grp_unplaced_title: 'Grenar utan fastställd koppling',
      grp_people_in: '{people} i {n} grenar',
      generated_tag: 'Jyutping, ej källbelagt',
      private_note: 'Personen kan vara i livet. Årtal, partner och anteckningar visas därför inte offentligt.',
      est_gen_note: 'Generationen är uppskattad utifrån generationstecknet (字輩) i namnet, eftersom grenen inte kunnat kopplas uppåt.',
      gen_mismatch: 'Generationstecknet i namnet anger generation {g}, men trädet har {diff} ovanför – ett mellanled saknas troligen i det extraherade materialet.',
      gen_too_few: { one: '{n} led för lite', other: '{n} led för lite' },
      gen_too_many: { one: '{n} led för mycket', other: '{n} led för mycket' },
      sec_book_name: 'Namn i 1857 års bok',
      same_person: '– samma person, annan skrivning.',
      sec_father: 'Far enligt boken',
      sec_birth_order: 'Anteckning om börd',
      sec_married: 'Gift med',
      sec_also_married: 'Även gift med',
      sec_spouses: 'Maka/makor enligt boken',
      sec_note: 'Anteckning',
      sec_source_note: 'Källanteckning',
      sec_source: 'Källa',
      sec_places: 'Platser i källan',
      sec_link: 'Om kopplingen till föräldern',
      sec_aliases: 'Förekommer även som (sammanslagna poster)',
      alias_spouses: 'Maka/makor:',
      sec_contents: 'Innehåll',
      sec_children: 'Barn',
      no_children: 'Inga barn dokumenterade i materialet för denna person.',
      and_more: '… och {n} till.',
      book_english_note: '',
      src_ref: 'vol. {v} s. {p}',
      src_vol: 'vol. {v}',
      show_in_tree: 'Visa i släktträdet',
      expand_desc: 'Fäll ut alla {n} ättlingar',
      expand_three: 'Fäll ut tre generationer',
      spouse_prefix: '— g. ',

      loose_branches: '{n} lösa grenar',
      info_title: 'Visa detaljer och källor',
      collapse: '▴ Fäll ihop',
      collapse_title: 'Fäll ihop grenen',
      children_pill: '▾ {n} barn',
      children_title: 'Visa {k} barn ({n} ättlingar totalt)',
      whole_branch: 'Hela grenen ({n})',
      whole_branch_title: 'Fäll ut alla {n} ättlingar',
      whole_branch_title_big: 'Fäll ut tre generationer (grenen har {n} ättlingar)',
      more_siblings: '+ {n} till …',
      more_siblings_title: 'Visa {k} till av {n} dolda syskon',

      // bidrag (js/contribute.js)
      contribute: 'Bidra',
      contribute_title: 'Skicka uppgifter, rättelser eller bilder till Anders',
      suggest_change: 'Föreslå ändring',
      cf_heading: 'Bidra till släktsajten',
      cf_intro: 'Det du skickar krypteras redan i din webbläsare och kan bara läsas av Anders. Inget visas på sajten förrän han har gått igenom det.',
      cf_about: 'Gäller',
      cf_about_remove: 'Ta bort kopplingen',
      cf_type: 'Vad gäller det?',
      cf_type_correction: 'Rättelse',
      cf_type_more: 'Mer om den här personen',
      cf_type_relative: 'En ny släkting',
      cf_type_photo: 'Foto eller dokument',
      cf_type_other: 'Annat',
      cf_text: 'Berätta',
      cf_text_ph: 'Skriv så mycket du vill. Berätta gärna också varifrån uppgiften kommer.',
      cf_name: 'Ditt namn (frivilligt)',
      cf_contact: 'Hur kan Anders nå dig? (frivilligt)',
      cf_contact_ph: 'WeChat-ID, e-post eller telefon',
      cf_relation: 'Din relation till familjen (frivilligt)',
      cf_relation_ph: 'T.ex. barnbarn till …',
      cf_images: 'Bilder (högst 5 st, jpg, png eller heic, högst 10 MB styck)',
      cf_add_images: 'Välj bilder …',
      cf_remove: 'Ta bort',
      cf_consent: 'Personerna på bilden går med på att den visas för släkten',
      cf_privacy_note: 'Bilderna förminskas och platsuppgifter (GPS) tas bort innan de skickas.',
      cf_send: 'Skicka',
      cf_sending: 'Krypterar och skickar …',
      cf_cancel: 'Avbryt',
      cf_thanks_title: 'Tack!',
      cf_thanks: 'Ditt bidrag har kommit fram. Anders går igenom allt innan något visas på sajten.',
      cf_another: 'Skicka ett till',
      cf_err_empty: 'Skriv något eller lägg till en bild.',
      cf_err_too_many: 'Högst 5 bilder.',
      cf_err_too_big: '{name} är större än 10 MB.',
      cf_err_type: '{name} gick inte att läsa som bild. Välj en jpg- eller png-bild (eller ta en skärmbild).',
      cf_err_send: 'Det gick inte att skicka. Kontrollera internetanslutningen och försök igen.',
      cf_err_rate: 'Många bidrag har skickats härifrån på kort tid. Vänta en stund och försök igen.',
      cf_not_open: 'Insändningen är inte igång än, så det går inte att skicka just nu. Försök igen om några dagar.',
      from_family: 'Från släkten',
      from_family_anon: 'En släkting',
      photo_open: 'Visa större bild',
    },

    en: {
      page_title: 'Beishan Yang — The family’s journey',
      brand_sub: 'The family’s journey through eight hundred years',
      updated: 'Last updated: {date}',
      draft_note: 'The English translation is a draft and has not yet been checked by the family.',
      lang_label: 'Language',
      views: 'Views',
      tab_tree: 'Family tree',
      tab_timeline: 'Timeline',
      tab_map: 'Map',
      tab_customs: 'Customs & rules',
      tab_clan: 'The whole clan',
      lock_now: 'Lock the site',
      lock_now_title: 'Lock the site (forget the password on this device)',
      admin_review: 'Review contributions',
      admin_review_title: 'Open the review page for contributions from the family',
      admin_footer: 'Administrator',
      theme: 'Switch colour theme',
      close: 'Close',

      lock_lead: 'The family history site is password protected. Ask Anders if you need the password.',
      lock_password: 'Password',
      lock_remember: 'Remember me on this device',
      lock_submit: 'Unlock',
      lock_busy: 'Unlocking …',
      lock_wrong: 'Wrong password. Check upper- and lower-case letters and try again.',

      legend_confirmed: 'Confirmed in the printed book of 1857',
      legend_direct: 'Direct line to the branch in Sweden',
      legend_mamma: 'The branch that moved to Sweden',
      legend_uncertain: 'Only an uncertain handwritten note',
      legend_gap: 'Unknown intermediate generations',
      legend_reconstructed: 'Reconstructed link',
      legend_uncertain_link: 'Uncertain / unknown link',
      legend_howto: 'Click a person to expand the branch · ⓘ shows details',
      legend_note: '† = Cantonese name generated (Jyutping), not from a source',
      tree_search: 'Search the whole clan (pinyin, Cantonese or characters) …',
      tree_search_label: 'Search for a person in the family tree',
      zoom_in: 'Zoom in',
      zoom_out: 'Zoom out',
      zoom_reset: 'Reset view',
      expand_family: 'Expand the family branch',
      expand_family_title: 'Reset to the family branch expanded',
      expand_to_mamma: 'Down to the branch in Sweden',
      find_mamma: 'Find the branch in Sweden',
      find_mamma_title: 'Move the view back to the branch in Sweden (nothing is collapsed)',
      expand_to_mamma_title: 'The family branch expanded down to the generation that moved to Sweden – children and grandchildren hidden',

      tl_heading: 'Eight hundred years in brief',
      tl_intro: 'From the founding ancestor’s move from Nánxióng in 1237, through the Qing dynasty’s coastal ban, to the printed genealogy of 1857 and the family’s own journey to Hong Kong and Sweden.',
      tl_namenote: 'Personal names are given in Cantonese pronunciation. † = the name was generated from the characters (Jyutping) and is not found in the family’s own documents.',
      tl_in_tree: 'In the family tree:',
      tl_on_map: 'show on map',
      approx: 'approx.',

      map_heading: 'Places in the family’s history',
      map_hint: 'Click a marker to read more. The line shows the approximate order of migration.',
      map_offline: 'Simplified map shown (the map server could not be reached).',
      map_offline_mode: 'Simplified map (built into the site, no external map server).',
      layer_family: 'The family’s journey',
      layer_villages: 'Neighbouring villages & marriages',
      layer_abroad: 'Emigration',
      map_sec_family: 'The family’s journey',
      map_sec_abroad: 'Emigration in the 19th century',
      map_hint_abroad: 'Clan members who, according to the book, travelled or died abroad.',
      map_sec_villages: 'Neighbouring villages and marriages',
      map_hint_villages: 'Villages mentioned in the genealogy, usually as the wives’ home village or where daughters married. The number is how many people in the book are linked to the village.',
      approx_pos: 'Approximate position',
      unknown_pos: 'Location unknown – not shown on the map',
      source_china_daily: 'Source: China Daily',
      popup_click: 'Click a person to show them in the family tree. The details come from the genealogy of 1857.',
      count_wife: { one: '{n} wife from here', other: '{n} wives from here' },
      count_daughter: { one: '{n} daughter married here', other: '{n} daughters married here' },
      count_abroad: { one: '{n} clan member travelled or died here', other: '{n} clan members travelled or died here' },
      count_mention: 'mentioned {n} more times',
      rel_wife: 'wife from here',
      rel_daughter: 'daughter married here',
      rel_abroad: 'travelled/died here',
      rel_mention: 'mentioned',

      customs_heading: 'Customs, rules and mourning rites',

      clan_heading: 'The whole Beishan Yang clan',
      clan_intro: 'The printed genealogy of 1857 records not only our own branch but thousands of members of the whole clan across 22 generations, in both the Eldest Branch (長房) and the Second Branch (次房). Here all ten volumes are compiled into a searchable database – the same people are also in the Family tree tab, where every branch can be expanded.',
      clan_search: 'Search names (pinyin or Chinese characters) …',
      clan_branches: 'Largest branches',
      clan_stats: '{records} entries from all ten volumes. After merging duplicates (the same person recorded in both the pedigree chart and the biography section) there are {persons} people, including the family’s own modern branch. {connected} of them form an unbroken chain from Sìrú-gong; the rest are in branches whose link upwards is not stated in the source. Cantonese names marked † / “Jyutping, not from a source” are generated mechanically from the characters – use Pinyin for reliable references to the book of 1857.',
      clan_more: '+ {n} smaller branches and single entries (search for a name above to find them).',
      clan_root_tag: 'in an unbroken chain from the founding ancestor',
      link_up_unknown: 'link upwards unknown',
      descendants: { one: '{n} descendant', other: '{n} descendants' },
      no_hits: 'No matches.',
      search_father: 'father {name}',
      search_link_unknown: 'link unknown',

      gen_short: 'Gen. {g}',
      gen_short_est: 'Gen. ≈{g}',
      gen_long: 'Generation {g} of the clan',
      gen_long_est: 'Generation ≈{g} of the clan',
      branch_eldest: 'Eldest Branch (長房)',
      branch_second: 'Second Branch (次房)',
      heir_no_heir: 'No heir (無嗣)',
      heir_adopted_out: 'Adopted out (出嗣)',
      heir_adopted_in: 'Adopted in (嗣子)',
      conf_confirmed: 'Confirmed in the printed book of 1857',
      conf_direct: 'Direct line to the branch in Sweden',
      conf_documented: 'The family’s own documents',
      conf_uncertain: 'Only an uncertain handwritten note',
      conf_gap: 'Undocumented intermediate generations in the source',
      link_reconstructed: 'Reconstructed link',
      link_ambiguous: 'Uncertain link – namesakes',
      link_gap: 'Link upwards unknown',
      link_family: 'Link according to the family’s documents',
      badge_mamma: 'Moved to Sweden',
      badge_you: 'Made this site',
      grp_unplaced_title: 'Branches without an established link',
      grp_people_in: '{people} in {n} branches',
      generated_tag: 'Jyutping, not from a source',
      private_note: 'This person may be alive. Years, partner and notes are therefore not shown publicly.',
      est_gen_note: 'The generation is estimated from the generation character (字輩) in the name, because the branch could not be linked upwards.',
      gen_mismatch: 'The generation character in the name indicates generation {g}, but the tree has {diff} above – an intermediate generation is probably missing from the extracted material.',
      gen_too_few: { one: '{n} generation too few', other: '{n} generations too few' },
      gen_too_many: { one: '{n} generation too many', other: '{n} generations too many' },
      sec_book_name: 'Name in the book of 1857',
      same_person: '– the same person, written differently.',
      sec_father: 'Father according to the book',
      sec_birth_order: 'Note on birth order',
      sec_married: 'Married to',
      sec_also_married: 'Also married to',
      sec_spouses: 'Wife/wives according to the book',
      sec_note: 'Note',
      sec_source_note: 'Note from the source',
      sec_source: 'Source',
      sec_places: 'Places in the source',
      sec_link: 'About the link to the parent',
      sec_aliases: 'Also appears as (merged entries)',
      alias_spouses: 'Wife/wives:',
      sec_contents: 'Contents',
      sec_children: 'Children',
      no_children: 'No children recorded in the material for this person.',
      and_more: '… and {n} more.',
      book_english_note: '',
      src_ref: 'vol. {v} p. {p}',
      src_vol: 'vol. {v}',
      show_in_tree: 'Show in the family tree',
      expand_desc: 'Expand all {n} descendants',
      expand_three: 'Expand three generations',
      spouse_prefix: '— m. ',

      loose_branches: '{n} loose branches',
      info_title: 'Show details and sources',
      collapse: '▴ Collapse',
      collapse_title: 'Collapse the branch',
      children_pill: { one: '▾ {n} child', other: '▾ {n} children' },
      children_title: 'Show {k} children ({n} descendants in all)',
      whole_branch: 'Whole branch ({n})',
      whole_branch_title: 'Expand all {n} descendants',
      whole_branch_title_big: 'Expand three generations (the branch has {n} descendants)',
      more_siblings: '+ {n} more …',
      more_siblings_title: 'Show {k} more of {n} hidden siblings',

      // contributions (js/contribute.js)
      contribute: 'Contribute',
      contribute_title: 'Send details, corrections or photos to Anders',
      suggest_change: 'Suggest a change',
      cf_heading: 'Contribute to the family site',
      cf_intro: 'What you send is encrypted in your browser and can only be read by Anders. Nothing appears on the site until he has reviewed it.',
      cf_about: 'About',
      cf_about_remove: 'Remove the link',
      cf_type: 'What is it about?',
      cf_type_correction: 'Correction',
      cf_type_more: 'More about this person',
      cf_type_relative: 'A new relative',
      cf_type_photo: 'Photo or document',
      cf_type_other: 'Other',
      cf_text: 'Tell us',
      cf_text_ph: 'Write as much as you like. Please also say where the information comes from.',
      cf_name: 'Your name (optional)',
      cf_contact: 'How can Anders reach you? (optional)',
      cf_contact_ph: 'WeChat ID, email or phone',
      cf_relation: 'Your relationship to the family (optional)',
      cf_relation_ph: 'E.g. grandchild of …',
      cf_images: 'Photos (up to 5, jpg, png or heic, max 10 MB each)',
      cf_add_images: 'Choose photos …',
      cf_remove: 'Remove',
      cf_consent: 'The people in the photo agree to it being shown to the family',
      cf_privacy_note: 'Photos are made smaller and location data (GPS) is removed before sending.',
      cf_send: 'Send',
      cf_sending: 'Encrypting and sending …',
      cf_cancel: 'Cancel',
      cf_thanks_title: 'Thank you!',
      cf_thanks: 'Your contribution has arrived. Anders reviews everything before anything is shown on the site.',
      cf_another: 'Send another',
      cf_err_empty: 'Write something or add a photo.',
      cf_err_too_many: 'Up to 5 photos.',
      cf_err_too_big: '{name} is larger than 10 MB.',
      cf_err_type: '{name} could not be read as an image. Choose a jpg or png (or take a screenshot).',
      cf_err_send: 'Sending failed. Check your internet connection and try again.',
      cf_err_rate: 'Many contributions have been sent from here recently. Please wait a while and try again.',
      cf_not_open: 'Sending is not switched on yet, so nothing can be sent right now. Please try again in a few days.',
      from_family: 'From the family',
      from_family_anon: 'A relative',
      photo_open: 'Show larger photo',
    },

    zh: {
      page_title: '北山楊氏 — 家族的旅程',
      brand_sub: '家族八百年的旅程',
      updated: '最後更新：{date}',
      draft_note: '中文譯本為初稿，尚未經家人校對。',
      lang_label: '語言',
      views: '檢視',
      tab_tree: '族譜樹',
      tab_timeline: '時間線',
      tab_map: '地圖',
      tab_customs: '家規與禮俗',
      tab_clan: '全族',
      lock_now: '鎖上網站',
      lock_now_title: '鎖上網站（在此裝置上忘記密碼）',
      admin_review: '審閱資料',
      admin_review_title: '打開審閱家族提供資料的頁面',
      admin_footer: '管理員',
      theme: '切換顏色主題',
      close: '關閉',

      lock_lead: '這個家族網站受密碼保護。如需密碼，請問 Anders。',
      lock_password: '密碼',
      lock_remember: '在此裝置上記住我',
      lock_submit: '解鎖',
      lock_busy: '解鎖中…',
      lock_wrong: '密碼錯誤。請檢查大小寫後再試。',

      legend_confirmed: '見於1857年刊印的族譜',
      legend_direct: '直系至瑞典一支',
      legend_mamma: '移居瑞典的一支',
      legend_uncertain: '僅見於不確定的手寫紙條',
      legend_gap: '未知的中間世代',
      legend_reconstructed: '重建的連接',
      legend_uncertain_link: '不確定／未知的連接',
      legend_howto: '點擊人物可展開分支 · ⓘ 顯示詳情',
      legend_note: '† = 粵語拼音（粵拼）由程式生成，未見於原始資料',
      tree_search: '在全族中搜尋（拼音、粵拼或漢字）…',
      tree_search_label: '在族譜樹中搜尋人物',
      zoom_in: '放大',
      zoom_out: '縮小',
      zoom_reset: '重設檢視',
      expand_family: '展開本家分支',
      expand_family_title: '重設為展開本家分支',
      expand_to_mamma: '展開至瑞典一支',
      find_mamma: '找瑞典一支',
      find_mamma_title: '把畫面移回瑞典一支（不會收起任何分支）',
      expand_to_mamma_title: '本家分支展開至移居瑞典的一代——隱藏子女及孫輩',

      tl_heading: '八百年簡史',
      tl_intro: '從始祖於1237年自南雄遷出，經歷清朝遷海令，到1857年刊印族譜，以及家族遷往香港和瑞典的旅程。',
      tl_namenote: '人名以粵語讀音標示。† = 拼音由漢字自動生成（粵拼），並非出自家族自己的文件。',
      tl_in_tree: '族譜樹中：',
      tl_on_map: '在地圖上顯示',
      approx: '約',

      map_heading: '家族歷史中的地方',
      map_hint: '點擊標記可閱讀更多。虛線顯示大致的遷徙次序。',
      map_offline: '正顯示簡化地圖（無法連接地圖伺服器）。',
      map_offline_mode: '簡化地圖（內置於網站，不使用外部地圖伺服器）。',
      layer_family: '家族的旅程',
      layer_villages: '鄰村與婚姻',
      layer_abroad: '出洋',
      map_sec_family: '家族的旅程',
      map_sec_abroad: '十九世紀出洋',
      map_hint_abroad: '族譜記載曾到海外或卒於海外的族人。',
      map_sec_villages: '鄰村與婚姻',
      map_hint_villages: '族譜中提到的村落，多為妻子的娘家或女兒出嫁之地。數字是族譜中與該村有關的人數。',
      approx_pos: '大約位置',
      unknown_pos: '位置不詳，不在地圖上顯示',
      source_china_daily: '出處：China Daily',
      popup_click: '點擊人物可在族譜樹中顯示。資料取自1857年族譜。',
      count_wife: '{n} 位妻子來自此地',
      count_daughter: '{n} 位女兒嫁到此地',
      count_abroad: '{n} 位族人曾到此地或卒於此地',
      count_mention: '另提及 {n} 次',
      rel_wife: '妻子來自此地',
      rel_daughter: '女兒嫁到此地',
      rel_abroad: '曾到此地／卒於此地',
      rel_mention: '提及',

      customs_heading: '家規、律例與喪服',

      clan_heading: '北山楊氏全族',
      clan_intro: '1857年刊印的族譜不只記載我們這一支，而是記錄了全族二十二代的數千名族人，包括長房和次房。這裏把全部十卷整理成可搜尋的資料庫——同一批人也在「族譜樹」分頁中，每一個分支都可以展開。',
      clan_search: '搜尋名字（拼音或漢字）…',
      clan_branches: '最大的分支',
      clan_stats: '全部十卷共 {records} 條記錄。合併重複記錄（同一人同時登記於世系圖及傳記部分）後，連同本家的現代分支共有 {persons} 人。其中 {connected} 人與泗儒公一脈相連，其餘分屬原始資料未說明上一代的分支。標有 † 或「粵拼，非出自原始資料」的粵語拼音由漢字自動生成——引用1857年族譜時請以漢字及拼音為準。',
      clan_more: '另有 {n} 個較小的分支及單獨記錄（可在上面搜尋名字）。',
      clan_root_tag: '與始祖一脈相連',
      link_up_unknown: '上一代不詳',
      descendants: '{n} 名後人',
      no_hits: '沒有結果。',
      search_father: '父 {name}',
      search_link_unknown: '連接不詳',

      gen_short: '第{g}世',
      gen_short_est: '約第{g}世',
      gen_long: '本族第{g}世',
      gen_long_est: '約為本族第{g}世',
      branch_eldest: '長房',
      branch_second: '次房',
      heir_no_heir: '無嗣',
      heir_adopted_out: '出嗣',
      heir_adopted_in: '嗣子',
      conf_confirmed: '見於1857年刊印的族譜',
      conf_direct: '直系至瑞典一支',
      conf_documented: '家族自己的文件',
      conf_uncertain: '僅見於不確定的手寫紙條',
      conf_gap: '原始資料中未記載的中間世代',
      link_reconstructed: '重建的連接',
      link_ambiguous: '不確定的連接——同名者',
      link_gap: '上一代不詳',
      link_family: '根據家族文件連接',
      badge_mamma: '移居瑞典',
      badge_you: '網站製作者',
      grp_unplaced_title: '未確定連接的分支',
      grp_people_in: '{people}，分屬 {n} 個分支',
      generated_tag: '粵拼，非出自原始資料',
      private_note: '此人可能仍在世，因此不公開顯示年份、配偶及備註。',
      est_gen_note: '由於此支無法向上連接，世代是根據名字中的字輩估計的。',
      gen_mismatch: '名字中的字輩顯示為第 {g} 世，但樹中上方{diff}——提取的資料中可能缺了一代。',
      gen_too_few: '少了 {n} 代',
      gen_too_many: '多了 {n} 代',
      sec_book_name: '1857年族譜中的名字',
      same_person: '——同一人，寫法不同。',
      sec_father: '族譜記載的父親',
      sec_birth_order: '排行備註',
      sec_married: '配偶',
      sec_also_married: '另一配偶',
      sec_spouses: '族譜記載的妻室',
      sec_note: '備註',
      sec_source_note: '原始資料筆記（英譯）',
      sec_source: '出處',
      sec_places: '原始資料中的地方',
      sec_link: '關於與父母的連接',
      sec_aliases: '亦見於（已合併的記錄）',
      alias_spouses: '妻室：',
      sec_contents: '內容',
      sec_children: '子女',
      no_children: '資料中沒有此人子女的記載。',
      and_more: '……另有 {n} 人。',
      book_english_note: '',
      src_ref: '第{v}卷第{p}頁',
      src_vol: '第{v}卷',
      show_in_tree: '在族譜樹中顯示',
      expand_desc: '展開全部 {n} 名後人',
      expand_three: '展開三代',
      spouse_prefix: '— 配 ',

      loose_branches: '{n} 個零散分支',
      info_title: '顯示詳情及出處',
      collapse: '▴ 收起',
      collapse_title: '收起分支',
      children_pill: '▾ {n} 個子女',
      children_title: '顯示 {k} 個子女（共 {n} 名後人）',
      whole_branch: '整個分支（{n}）',
      whole_branch_title: '展開全部 {n} 名後人',
      whole_branch_title_big: '展開三代（此分支共有 {n} 名後人）',
      more_siblings: '+ 另外 {n} 人…',
      more_siblings_title: '再顯示 {n} 名隱藏兄弟姊妹中的 {k} 名',

      // 提供資料 (js/contribute.js)
      contribute: '提供資料',
      contribute_title: '向 Anders 提供資料、更正或相片',
      suggest_change: '提供資料',
      cf_heading: '為族譜網站提供資料',
      cf_intro: '你提交的內容會在你的瀏覽器中加密，只有 Anders 能夠閱讀。所有內容經他審閱後才會在網站上顯示。',
      cf_about: '關於',
      cf_about_remove: '取消關聯',
      cf_type: '類別',
      cf_type_correction: '更正',
      cf_type_more: '關於此人的更多資料',
      cf_type_relative: '新增親屬',
      cf_type_photo: '相片或文件',
      cf_type_other: '其他',
      cf_text: '內容',
      cf_text_ph: '請隨意書寫，並請註明資料來源。',
      cf_name: '你的姓名（可選填）',
      cf_contact: 'Anders 可如何聯絡你？（可選填）',
      cf_contact_ph: '微信號、電郵或電話',
      cf_relation: '你與家族的關係（可選填）',
      cf_relation_ph: '例如：……的孫兒',
      cf_images: '相片（最多 5 張，jpg、png 或 heic，每張不超過 10 MB）',
      cf_add_images: '選擇相片……',
      cf_remove: '刪除',
      cf_consent: '相片中的人同意讓家族成員看到這張相片',
      cf_privacy_note: '相片會先縮小，並刪除位置資料（GPS）後才傳送。',
      cf_send: '提交',
      cf_sending: '正在加密及傳送……',
      cf_cancel: '取消',
      cf_thanks_title: '多謝！',
      cf_thanks: '已收到你提供的資料。Anders 會先審閱所有內容，然後才在網站上顯示。',
      cf_another: '再提交一項',
      cf_err_empty: '請填寫內容或加入相片。',
      cf_err_too_many: '最多 5 張相片。',
      cf_err_too_big: '{name} 超過 10 MB。',
      cf_err_type: '無法讀取 {name}。請選擇 jpg 或 png 相片（或使用螢幕截圖）。',
      cf_err_send: '傳送失敗。請檢查網絡連線後再試。',
      cf_err_rate: '短時間內已從此處提交了多項資料，請稍後再試。',
      cf_not_open: '提交功能尚未啟用，暫時無法傳送。請過幾天再試。',
      from_family: '家族提供',
      from_family_anon: '一位親屬',
      photo_open: '顯示大圖',
    },
  };

  // ------------------------------------------------------------ språkval
  function store(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }

  function detect() {
    const saved = store(() => localStorage.getItem(STORE_KEY), null);
    if (STRINGS[saved]) return saved;
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'sv']).map((l) =>
      String(l).toLowerCase()
    );
    for (const l of prefs) {
      if (l.startsWith('sv')) return 'sv';
      if (l.startsWith('zh') || l.startsWith('yue')) return 'zh';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }

  let lang = detect();
  const info = () => LANGS.find((l) => l.code === lang);

  // ------------------------------------------------------------ gränssnitt
  function t(key, vars) {
    let s = STRINGS[lang][key];
    if (s == null) s = STRINGS.sv[key];
    if (s == null) return key;
    if (typeof s === 'object') {
      const n = vars && typeof vars.n === 'number' ? vars.n : 0;
      s = n === 1 ? s.one : s.other;
    }
    // tal formateras efter språket (1 234 / 1,234)
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : typeof vars[k] === 'number' ? num(vars[k]) : vars[k]));
    return s;
  }

  function num(n) {
    return Number(n).toLocaleString(info().locale);
  }

  // ------------------------------------------------------------ innehåll
  const content = {}; // lang -> { texts: Map, patterns: [[RegExp, ersättning]] }

  async function loadContent(code) {
    code = code || lang;
    if (code === 'sv' || content[code]) return;
    try {
      const tr = await window.SiteLock.fetchJSON('translations_' + code + '.json');
      content[code] = {
        texts: new Map(Object.entries(tr.texts || {}).filter(([, v]) => v)),
        patterns: (tr.patterns || []).map((p) => [new RegExp(p.sv), p.tr]),
      };
    } catch (e) {
      content[code] = { texts: new Map(), patterns: [] }; // visa svenskan
    }
  }

  // Översätt en svensk text ur datat. Okänd text returneras oförändrad.
  function dt(s) {
    if (lang === 'sv' || s == null || s === '') return s;
    const c = content[lang];
    if (!c) return s;
    const hit = c.texts.get(s);
    if (hit) return hit;
    for (const [rx, rep] of c.patterns) {
      if (rx.test(s)) return s.replace(rx, rep);
    }
    return s;
  }

  // ------------------------------------------------------------ sidan
  function formatUpdated(el) {
    const iso = el.getAttribute('data-published');
    if (!iso) return;
    const d = new Date(iso);
    if (isNaN(d)) return;
    const date = d.toLocaleString(info().locale, {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm',
    });
    el.textContent = t('updated', { date });
  }

  // Element med data-i18n="nyckel" får sin text; data-i18n-attr="placeholder:nyckel,title:nyckel" sätter attribut.
  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        el.setAttribute(attr, t(key));
      });
    });
    root.querySelectorAll('.lang-switch button').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (root === document) {
      document.documentElement.lang = info().html;
      document.title = t('page_title');
      const upd = document.getElementById('last-updated');
      if (upd) formatUpdated(upd);
      const draft = document.getElementById('draft-note');
      if (draft) {
        draft.textContent = t('draft_note');
        draft.hidden = !t('draft_note');
      }
    }
  }

  // Liten knappgrupp SV · EN · 中
  function switcher() {
    const wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('data-i18n-attr', 'aria-label:lang_label');
    wrap.innerHTML = LANGS.map(
      (l) => `<button type="button" data-lang="${l.code}" lang="${l.html}" title="${l.name}" aria-label="${l.name}">${l.short}</button>`
    ).join('');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lang]');
      if (b) setLang(b.dataset.lang);
    });
    return wrap;
  }

  let unlocked = false;
  async function setLang(code) {
    if (!STRINGS[code] || code === lang) return;
    lang = code;
    store(() => localStorage.setItem(STORE_KEY, code));
    if (unlocked) await loadContent(code);
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }));
  }

  // Anropas av app.js när datat är upplåst.
  async function onUnlocked() {
    unlocked = true;
    await loadContent(lang);
  }

  function init() {
    document.querySelectorAll('[data-lang-switch]').forEach((slot) => slot.replaceWith(switcher()));
    apply();
  }

  return {
    LANGS,
    get lang() {
      return lang;
    },
    get locale() {
      return info().locale;
    },
    t,
    num,
    dt,
    apply,
    init,
    setLang,
    switcher,
    onUnlocked,
  };
})();
