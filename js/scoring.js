/* ------------------------- ASSESSMENT ------------------------- */
function computeClientScale(client) {
  let score = 0;
  if (client.companySize === "5+") score += 3;
  else if (client.companySize === "2-5") score += 2;
  else if (client.companySize === "1") score += 1;

  if (score >= 3) return "Veliki";
  if (score >= 2) return "Srednji";
  return "Mali";
}

function computeDecisionComplexity(client) {
  let score = 0;

  if (client.decisionModel === "central") score += 3;
  else if (client.decisionModel === "regional") score += 2;
  else if (client.decisionModel === "local") score += 1;

  if (score >= 3) return "Slozena";
  if (score >= 2) return "Srednja";
  return "Jednostavna";
}

function computeCommercialPotential(client) {
  let score = 0;

  if (client.revenueDriverPrimary === "projects") score += 3;
  else if (["consultative", "premium", "services"].includes(client.revenueDriverPrimary)) score += 2;
  else if (["core_assortment", "promo_sales"].includes(client.revenueDriverPrimary)) score += 1;

  if (client.pilotReadiness === "confirmed") score += 3;
  else if (client.pilotReadiness === "discussed") score += 2;
  else if (client.pilotReadiness === "possible") score += 1;

  if (client.leadTemperature === "hot") score += 2;
  else if (client.leadTemperature === "warm") score += 1;

  if (client.urgencyLevel === "high") score += 2;
  else if (client.urgencyLevel === "medium") score += 1;

  if (score >= 8) return "Jak";
  if (score >= 4) return "Solidan";
  return "Ogranicen";
}

function computeBuyingReadiness(client) {
  let score = 0;

  if (client.budgetStatus === "approved") score += 3;
  else if (client.budgetStatus === "planned") score += 2;
  else if (client.budgetStatus === "exploring") score += 1;

  if (client.leadTemperature === "hot") score += 2;
  else if (client.leadTemperature === "warm") score += 1;

  if (client.relationshipStrength === "trusted") score += 2;
  else if (client.relationshipStrength === "working") score += 1;

  if (client.pilotReadiness === "confirmed") score += 2;
  else if (client.pilotReadiness === "discussed") score += 1;

  if (score >= 7) return "Visoka";
  if (score >= 4) return "Srednja";
  return "Niska";
}

function computeMomentum(client) {
  let score = 0;
  const inactivityDays = daysSince(client.lastActionAt);

  if (client.stage === "negotiation") score += 3;
  else if (client.stage === "offer_sent") score += 3;
  else if (client.stage === "meeting_done") score += 2;
  else if (client.stage === "waiting") score += 1;

  if (client.urgencyLevel === "high") score += 2;
  else if (client.urgencyLevel === "medium") score += 1;

  if (inactivityDays <= 2) score += 2;
  else if (inactivityDays <= 5) score += 1;
  else if (inactivityDays >= 10) score -= 2;

  if (score >= 5) return "Jak";
  if (score >= 2) return "Stabilan";
  return "Slab";
}

function computePaymentDiscipline(client) {
  const speed = client.payment?.paymentSpeed || null;
  if (speed === "on_time") return "Dobra";
  if (speed === "late") return "Promenljiva";
  return "Nepoznata";
}

function computeDealValueBand(client) {
  const value = Number(client.dealValue || 0);

  if (value >= 5000) return "Velika";
  if (value >= 2000) return "Srednja";
  if (value > 0) return "Manja";
  return "Nepoznata";
}

function computeDealProbabilityBand(client) {
  const probability = Number(client.dealProbability || 0);

  if (probability >= 90) return "Vrlo visoka";
  if (probability >= 75) return "Visoka";
  if (probability >= 50) return "Srednja";
  if (probability >= 25) return "Niska";
  return "Nepoznata";
}

function computePriorityBase(client) {
  const potential = computeCommercialPotential(client);
  const readiness = computeBuyingReadiness(client);
  const momentum = computeMomentum(client);
  const payment = computePaymentDiscipline(client);
  const dealValueBand = computeDealValueBand(client);
  const dealProbabilityBand = computeDealProbabilityBand(client);

  let score = 0;
  if (potential === "Jak") score += 2;
  else if (potential === "Solidan") score += 1;

  if (readiness === "Visoka") score += 2;
  else if (readiness === "Srednja") score += 1;

  if (momentum === "Jak") score += 1;
  else if (momentum === "Slab") score -= 1;

  if (payment === "Dobra") score += 1;
  if (payment === "Promenljiva") score -= 1;

  if (dealValueBand === "Velika") score += 2;
  else if (dealValueBand === "Srednja") score += 1;

  if (dealProbabilityBand === "Vrlo visoka") score += 2;
  else if (dealProbabilityBand === "Visoka") score += 1;
  else if (dealProbabilityBand === "Nepoznata") score -= 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function computePulseScore(client) {
  let score = 24;

  const potential = computeCommercialPotential(client);
  const readiness = computeBuyingReadiness(client);
  const momentum = computeMomentum(client);
  const complexity = computeDecisionComplexity(client);
  const payment = computePaymentDiscipline(client);
  const dealValueBand = computeDealValueBand(client);
  const dealProbabilityBand = computeDealProbabilityBand(client);
  const inactivityDays = daysSince(client.lastActionAt);
  const decisionDays = daysUntil(client.expectedDecisionDate);

  if (potential === "Jak") score += 28;
  else if (potential === "Solidan") score += 18;
  else score += 8;

  if (readiness === "Visoka") score += 24;
  else if (readiness === "Srednja") score += 16;
  else score += 6;

  if (momentum === "Jak") score += 16;
  else if (momentum === "Stabilan") score += 10;
  else score += 3;

  if (complexity === "Slozena") score -= 6;
  else if (complexity === "Jednostavna") score += 4;

  if (payment === "Dobra") score += 8;
  else if (payment === "Promenljiva") score -= 8;

  if (dealValueBand === "Velika") score += 10;
  else if (dealValueBand === "Srednja") score += 6;
  else if (dealValueBand === "Manja") score += 2;

  if (dealProbabilityBand === "Vrlo visoka") score += 12;
  else if (dealProbabilityBand === "Visoka") score += 8;
  else if (dealProbabilityBand === "Srednja") score += 4;
  else if (dealProbabilityBand === "Nepoznata") score -= 2;

  if (decisionDays !== null && decisionDays >= 0 && decisionDays <= 14) score += 6;
  else if (decisionDays !== null && decisionDays >= 15 && decisionDays <= 30) score += 3;
  else if (decisionDays !== null && decisionDays < 0) score -= 6;

  if (client.stage === "won") score -= 15;
  if (client.stage === "lost") score -= 25;

  if (inactivityDays >= 14) score -= 10;
  else if (inactivityDays >= 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function getPulseBandMeta(score) {
  if (score >= 80) {
    return { label: "Prioritet", className: "band-priority" };
  }
  if (score >= 60) {
    return { label: "Jako dobro", className: "band-strong" };
  }
  if (score >= 40) {
    return { label: "Aktivno", className: "band-active" };
  }
  return { label: "Hladno", className: "band-cold" };
}

function getAssessmentReason(client) {
  const reasons = [];

  const potential = computeCommercialPotential(client);
  const readiness = computeBuyingReadiness(client);
  const momentum = computeMomentum(client);
  const payment = computePaymentDiscipline(client);
  const dealValueBand = computeDealValueBand(client);
  const dealProbabilityBand = computeDealProbabilityBand(client);

  reasons.push(`potencijal: ${potential.toLowerCase()}`);
  reasons.push(`spremnost: ${readiness.toLowerCase()}`);
  reasons.push(`momentum: ${momentum.toLowerCase()}`);

  if (client.pilotReadiness) {
    reasons.push(`pilot: ${pilotReadinessLabel(client.pilotReadiness).toLowerCase()}`);
  }

  if (client.budgetStatus) {
    reasons.push(`budzet: ${budgetStatusLabel(client.budgetStatus).toLowerCase()}`);
  }

  reasons.push(`naplata: ${payment.toLowerCase()}`);

  if (dealValueBand !== "Nepoznata") {
    reasons.push(`vrednost prilike: ${dealValueBand.toLowerCase()}`);
  }

  if (dealProbabilityBand !== "Nepoznata") {
    reasons.push(`sansa za zatvaranje: ${dealProbabilityBand.toLowerCase()}`);
  }

  return "Procena se zasniva na: " + reasons.join(", ") + ".";
}

function getPulseScoreExplanation(client) {
  const parts = [];
  const potential = computeCommercialPotential(client);
  const readiness = computeBuyingReadiness(client);
  const momentum = computeMomentum(client);

  if (client.leadTemperature === "hot") {
    parts.push("lead je vruc");
  } else if (client.leadTemperature === "warm") {
    parts.push("lead je topao");
  }

  if (client.budgetStatus === "approved") {
    parts.push("budzet je odobren");
  } else if (client.budgetStatus === "planned") {
    parts.push("budzet je planiran");
  }

  if (client.pilotReadiness === "confirmed") {
    parts.push("pilot je dogovoren");
  } else if (client.pilotReadiness === "discussed") {
    parts.push("pilot je u razgovoru");
  }

  if (client.relationshipStrength === "trusted") {
    parts.push("odnos je jak");
  }

  if (Number(client.dealValue || 0) >= 5000) {
    parts.push("prilika ima jacu komercijalnu vrednost");
  } else if (Number(client.dealValue || 0) >= 2000) {
    parts.push("prilika ima solidnu komercijalnu vrednost");
  }

  if (Number(client.dealProbability || 0) >= 75) {
    parts.push("verovatnoca zatvaranja je visoka");
  } else if (Number(client.dealProbability || 0) >= 50) {
    parts.push("postoji realna sansa za zatvaranje");
  }

  if (momentum === "Slab") {
    parts.push("ali je momentum oslabio");
  } else if (daysSince(client.lastActionAt) >= 7) {
    parts.push("aktivnost je usporila");
  }

  if (!parts.length) {
    return `Score trenutno najvise zavisi od procene: potencijal ${potential.toLowerCase()}, spremnost ${readiness.toLowerCase()} i momentum ${momentum.toLowerCase()}.`;
  }

  return `Score je ovakav jer ${parts.join(", ")}, uz procenu da je potencijal ${potential.toLowerCase()}, spremnost ${readiness.toLowerCase()} i momentum ${momentum.toLowerCase()}.`;
}

function getPulseSignals(client) {
  const positive = [];
  const risks = [];
  const inactivityDays = daysSince(client.lastActionAt);

  if (client.leadTemperature === "hot") positive.push("Lead je vruc i postoji jaci interes.");
  else if (client.leadTemperature === "warm") positive.push("Lead je topao i komunikacija je otvorena.");
  else risks.push("Lead je hladan i treba dodatno zagrevanje.");

  if (client.budgetStatus === "approved") positive.push("Budzet je odobren.");
  else if (client.budgetStatus === "planned") positive.push("Budzet je planiran.");
  else if (client.budgetStatus === "unknown") risks.push("Budzet jos nije poznat.");
  else risks.push("Klijent jos istrazuje opcije i budzet nije siguran.");

  if (client.pilotReadiness === "confirmed") positive.push("Pilot je vec dogovoren.");
  else if (client.pilotReadiness === "discussed") positive.push("Pilot je u ozbiljnom razgovoru.");
  else if (client.pilotReadiness === "none") risks.push("Nema spremnosti za pilot.");

  if (client.relationshipStrength === "trusted") positive.push("Postoji jak odnos i poverenje.");
  else if (client.relationshipStrength === "new") risks.push("Odnos je jos u ranoj fazi.");

  if (client.urgencyLevel === "high") positive.push("Potreba je urgentna.");
  else if (client.urgencyLevel === "low") risks.push("Urgentnost je niska.");

  if (client.stage === "negotiation") positive.push("Nalog je vec u pregovorima.");
  if (client.stage === "offer_sent") positive.push("Ponuda je poslata i postoji konkretan sledeci korak.");
  if (client.stage === "lost") risks.push("Nalog je trenutno izgubljen.");

  if (inactivityDays >= 10) risks.push(`Nema aktivnosti vec ${inactivityDays} dana.`);
  else if (inactivityDays <= 2) positive.push("Komunikacija je sveza.");

  if (client.payment?.paymentSpeed === "late") risks.push("Postoji istorija kasnjenja u placanju.");
  if (client.payment?.paymentSpeed === "on_time") positive.push("Naplata je bila uredna.");

  if (Number(client.dealValue || 0) >= 5000) positive.push("Prilika ima visu komercijalnu vrednost.");
  else if (Number(client.dealValue || 0) >= 2000) positive.push("Prilika ima solidnu procenjenu vrednost.");
  else if (Number(client.dealValue || 0) === 0) risks.push("Nije uneta procenjena vrednost prilike.");

  if (Number(client.dealProbability || 0) >= 75) positive.push("Sansa za zatvaranje deluje visoko.");
  else if (Number(client.dealProbability || 0) >= 50) positive.push("Postoji realna sansa da se posao zatvori.");
  else if (Number(client.dealProbability || 0) > 0) risks.push("Verovatnoca zatvaranja je jos u ranoj fazi.");
  else risks.push("Nije procenjena verovatnoca zatvaranja.");

  const decisionDays = daysUntil(client.expectedDecisionDate);
  if (decisionDays !== null && decisionDays >= 0 && decisionDays <= 14) {
    positive.push("Odluka se ocekuje uskoro.");
  } else if (decisionDays !== null && decisionDays < 0) {
    risks.push("Ocekivani datum odluke je probijen.");
  }

  if (positive.length === 0) {
    positive.push("Postoje osnovni uslovi za dalje pracenje naloga.");
  }

  if (risks.length === 0) {
    risks.push("Trenutno nema izrazitih red flags signala.");
  }

  return { positive, risks };
}

/* ------------------------- TODAY ENGINE ------------------------- */
function getTodaySuggestion(client) {
  const days = daysSince(client.lastActionAt);
  const valueBias = computePriorityBase(client);

  let priority = "none";
  let actionType = "";
  let actionLabel = "";
  let reason = "";

  if (client.payment?.lastInvoiceDate && !client.payment?.lastPaidDate && daysSince(client.payment.lastInvoiceDate) >= 5) {
    priority = valueBias === "high" ? "high" : "medium";
    actionType = "payment_reminder";
    actionLabel = "Podsetnik za placanje";
    reason = "Poslata faktura je bez potvrde o uplati 5+ dana.";
    return { priority, actionType, actionLabel, reason, days, stage: client.stage };
  }

  switch (client.stage) {
    case "meeting_done":
      if (days >= 1) {
        priority = "high";
        actionType = "after_meeting";
        actionLabel = "Posalji ponudu";
        reason = "Posle sastanka nema sledeceg koraka.";
      }
      break;

    case "offer_sent":
      if (days >= 6) {
        priority = "high";
        actionType = "followup_medium";
        actionLabel = "Srednji follow-up";
        reason = "Ponuda je poslata pre 6+ dana bez odgovora.";
      } else if (days >= 3) {
        priority = "medium";
        actionType = "followup_light";
        actionLabel = "Blagi follow-up";
        reason = "Ponuda je poslata pre 3+ dana.";
      }
      break;

    case "waiting":
      if (days >= 3) {
        priority = "medium";
        actionType = "status_check";
        actionLabel = "Proveri status";
        reason = "Klijent je u cekanju 3+ dana.";
      }
      break;

    case "negotiation":
      if (days >= 2) {
        priority = "high";
        actionType = "negotiation_push";
        actionLabel = "Push ka odluci";
        reason = "Pregovori stoje 2+ dana.";
      }
      break;

    case "new":
      if (days >= 2) {
        priority = valueBias === "high" ? "high" : "medium";
        actionType = "first_contact";
        actionLabel = "Prvi kontakt";
        reason = "Novi klijent bez aktivnosti 2+ dana.";
      }
      break;
  }

  if (priority === "medium" && valueBias === "high") priority = "high";

  return { priority, actionType, actionLabel, reason, days, stage: client.stage };
}

function isOverdue(client) {
  const suggestion = getTodaySuggestion(client);
  return (
    (client.stage === "offer_sent" && suggestion.days >= 6) ||
    (client.stage === "waiting" && suggestion.days >= 5) ||
    (client.stage === "negotiation" && suggestion.days >= 4) ||
    (client.payment?.lastInvoiceDate && !client.payment?.lastPaidDate && daysSince(client.payment.lastInvoiceDate) >= 7)
  );
}

function isDoneStage(stage) {
  return stage === "won" || stage === "lost";
}

/* ------------------------- MESSAGES ------------------------- */
function getBusinessAngle(client) {
  switch (client.revenueDriverPrimary) {
    case "services":
      return "unapredimo nacin na koji predstavljate i prodajete usluge";
    case "core_assortment":
      return "bolje istaknemo vasu osnovnu ponudu i asortiman";
    case "promo_sales":
      return "pojacamo vidljivost akcijskih i promotivnih ponuda";
    case "premium":
      return "damo vecu vidljivost premium segmentu i proizvodima vise vrednosti";
    case "consultative":
      return "ojacamo preporuku i savetodajni pristup u prodaji";
    case "projects":
      return "podrzimo pilot ili projekat kroz jasniji prodajni nastup";
    default:
      return "unapredimo komercijalnu komunikaciju i vidljivost ponude";
  }
}

function getActionMessage(client, actionType) {
  const name = client.name || "klijent";
  const angle = getBusinessAngle(client);

  switch (actionType) {
    case "first_contact":
      return `Javljam se u vezi naseg prethodnog kontakta.

Verujem da postoji prostor da ${angle}, pa bih voleo da se cujemo i prodjemo kroz to.

Recite mi kada vam odgovara kratak razgovor.`;

    case "after_meeting":
      return `Hvala na vremenu i razgovoru.

Na osnovu onoga sto smo prosli, saljem predlog koji pokriva kljucne tacke i sledece korake.

Ako zelite, mozemo kratko proci kroz detalje i potvrditi kako vam najvise odgovara da nastavimo.`;

    case "status_check":
      return `Samo da proverim da li ima nekih novosti sa vase strane.

Ako vam treba jos neka informacija ili dodatno pojasnjenje, tu sam.`;

    case "negotiation_push":
      return `Mislim da smo prosli sve kljucne stvari oko predloga.

Ako je sa vase strane sve jasno, mozemo definisati sledeci korak i krenuti dalje.

Javite mi kako vam najvise odgovara da to zakljucimo.`;

    case "payment_reminder":
      return `Samo da proverim status fakture koju smo poslali.

Ako je potrebno jos nesto sa nase strane, slobodno javite.`;

    default:
      return `Javljam se u vezi sledeceg koraka za ${name}.`;
  }
}
