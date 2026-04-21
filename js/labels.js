/* ------------------------- LABELS ------------------------- */
function industryLabel(value) {
  switch (value) {
    case "retail": return "Trgovina / Retail";
    case "pharmacy": return "Farmacija / Apoteka";
    case "b2b_services": return "B2B usluge";
    case "other": return "Drugo";
    default: return "-";
  }
}

function sizeLabel(value) {
  switch (value) {
    case "1": return "1 lokacija / mali";
    case "2-5": return "2-5 lokacija / srednji";
    case "5+": return "5+ lokacija / veci";
    default: return "-";
  }
}

function clientTypeLabel(value) {
  switch (value) {
    case "legal": return "Pravna lica";
    case "physical": return "Fizicka lica";
    case "mixed": return "Mesovito";
    default: return "-";
  }
}

function decisionLabel(value) {
  switch (value) {
    case "central": return "Centralno";
    case "regional": return "Regionalno / hibridno";
    case "local": return "Lokalno / po objektima";
    default: return "-";
  }
}

function yesNoLabel(value) {
  switch (value) {
    case "yes": return "Da";
    case "no": return "Ne";
    default: return "-";
  }
}

function retailLocationTypeLabel(value) {
  switch (value) {
    case "center": return "Centar / frekventne zone";
    case "residential": return "Naselja";
    case "mall": return "Trzni centri";
    case "mixed": return "Mesovito";
    default: return "-";
  }
}

function retailAssortmentLabel(value) {
  switch (value) {
    case "core": return "Stalan asortiman";
    case "focused": return "Uzi i fokusiran asortiman";
    case "mixed": return "Mesovito";
    default: return "-";
  }
}

function retailPromoPotentialLabel(value) {
  switch (value) {
    case "limited": return "Ogranicena";
    case "solid": return "Solidna";
    case "strong": return "Izrazena";
    case "varies": return "Razlikuje se po lokaciji";
    default: return "-";
  }
}

function suppliersLabel(value) {
  switch (value) {
    case "wide": return "Sirok portfolio";
    case "limited": return "Ogranicen broj";
    default: return "-";
  }
}

function trafficLabel(value) {
  switch (value) {
    case "high": return "Visok";
    case "medium": return "Srednji";
    case "low": return "Nizak";
    default: return "-";
  }
}

function pharmacyFocusLabel(value) {
  switch (value) {
    case "otc": return "OTC";
    case "rx": return "Rx / recepti";
    case "mixed": return "Mesano";
    case "dermo": return "Dermo / kozmetika";
    default: return "-";
  }
}

function pharmacyCentralizationLabel(value) {
  switch (value) {
    case "central": return "Centralno";
    case "hybrid": return "Delimicno centralno";
    case "local": return "Lokalno";
    default: return "-";
  }
}

function revenueDriverPrimaryLabel(value) {
  switch (value) {
    case "services": return "Usluge";
    case "core_assortment": return "Stalan asortiman";
    case "promo_sales": return "Akcijska prodaja";
    case "premium": return "Premium / visa marza";
    case "consultative": return "Preporuka osoblja / savetodajna prodaja";
    case "impulse": return "Impulsna kupovina";
    case "projects": return "Projekti / ugovori";
    case "key_categories": return "Kljucne kategorije";
    case "mixed": return "Mesovito";
    case "other": return "Drugo";
    default: return "-";
  }
}

function leadTemperatureLabel(value) {
  switch (value) {
    case "cold": return "Hladan";
    case "warm": return "Topao";
    case "hot": return "Vruc";
    default: return "-";
  }
}

function budgetStatusLabel(value) {
  switch (value) {
    case "unknown": return "Nepoznato";
    case "exploring": return "Ispituju opcije";
    case "planned": return "Planiran budzet";
    case "approved": return "Odobren budzet";
    default: return "-";
  }
}

function urgencyLevelLabel(value) {
  switch (value) {
    case "low": return "Niska";
    case "medium": return "Srednja";
    case "high": return "Visoka";
    default: return "-";
  }
}

function pilotReadinessLabel(value) {
  switch (value) {
    case "none": return "Nema interesa";
    case "possible": return "Postoji potencijal";
    case "discussed": return "Pilot je u razgovoru";
    case "confirmed": return "Pilot dogovoren";
    default: return "-";
  }
}

function relationshipStrengthLabel(value) {
  switch (value) {
    case "new": return "Novi kontakt";
    case "working": return "Imamo komunikaciju";
    case "trusted": return "Dobar odnos";
    default: return "-";
  }
}

function dealProbabilityLabel(value) {
  switch (String(value || "")) {
    case "25": return "25% - rano interesovanje";
    case "50": return "50% - realna prilika";
    case "75": return "75% - ozbiljni pregovori";
    case "90": return "90% - pred zatvaranjem";
    default: return "-";
  }
}

function revenueTagLabel(value) {
  switch (value) {
    case "seasonal": return "Sezonska prodaja";
    case "private_label": return "Privatna robna marka";
    case "wide_assortment": return "Sirok asortiman";
    case "repeat_customers": return "Repeat kupci";
    case "staff_recommendation": return "Preporuka osoblja";
    case "promo_dependency": return "Jak oslonac na akcije";
    case "premium_visibility": return "Premium vidljivost";
    case "new_launches": return "Novi proizvodi / lansiranja";
    default: return value;
  }
}

function actionTypeLabel(actionType) {
  switch (actionType) {
    case "first_contact": return "Prvi kontakt";
    case "after_meeting": return "Posle sastanka";
    case "followup": return "Follow-up";
    case "followup_light": return "Blagi follow-up";
    case "followup_medium": return "Srednji follow-up";
    case "followup_final": return "Finalni follow-up";
    case "followup_strong": return "Jaci follow-up";
    case "status_check": return "Provera statusa";
    case "negotiation_push": return "Push ka odluci";
    case "payment_reminder": return "Podsetnik za placanje";
    case "invoice_sent": return "Poslata faktura";
    case "paid_on_time": return "Placeno u roku";
    case "paid_late": return "Placeno sa kasnjenjem";
    case "phone_call": return "Poziv";
    case "meeting_scheduled": return "Zakazan sastanak";
    case "reminder": return "Podsetnik";
    case "inactive_checkin": return "Reaktivacija klijenta";
    case "internal_note": return "Interna beleska";
    default: return "Akcija";
  }
}

function actionTypeKeyFromLabel(label) {
  switch (label) {
    case "Prvi kontakt": return "first_contact";
    case "Posle sastanka": return "after_meeting";
    case "Follow-up": return "followup";
    case "Blagi follow-up": return "followup_light";
    case "Srednji follow-up": return "followup_medium";
    case "Finalni follow-up": return "followup_final";
    case "Jaci follow-up": return "followup_strong";
    case "Provera statusa": return "status_check";
    case "Push ka odluci": return "negotiation_push";
    case "Podsetnik za placanje": return "payment_reminder";
    default: return "followup";
  }
}

function actionHumanLabel(actionType) {
  switch (actionType) {
    case "first_contact": return "Poslat prvi kontakt";
    case "after_meeting": return "Poslata poruka posle sastanka";
    case "followup": return "Poslat follow-up";
    case "followup_light": return "Poslat blagi follow-up";
    case "followup_medium": return "Poslat srednji follow-up";
    case "followup_final": return "Poslat finalni follow-up";
    case "followup_strong": return "Poslat jaci follow-up";
    case "status_check": return "Poslata provera statusa";
    case "negotiation_push": return "Poslat push ka odluci";
      case "payment_reminder": return "Poslat podsetnik za placanje";
      case "phone_call": return "Evidentiran poziv";
      case "email": return "Poslat email";
      case "meeting_held": return "Odrzan sastanak";
      case "offer_sent": return "Poslata ponuda";
      case "message": return "Poslata poruka";
      case "production": return "Pokrenuta izrada";
      case "meeting_scheduled": return "Zakazan sastanak";
      case "reminder": return "Napravljen podsetnik";
      case "inactive_checkin": return "Pokrenuta reaktivacija klijenta";
      case "internal_note": return "Dodana interna beleska";
    default: return "Poslata akcija";
  }
}

function fallbackActionType(stage) {
  switch (stage) {
    case "meeting_done": return "after_meeting";
    case "offer_sent": return "followup";
    case "waiting": return "status_check";
    case "negotiation": return "negotiation_push";
    case "new": return "first_contact";
    default: return "followup";
  }
}
