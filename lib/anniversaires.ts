import { db } from "@/lib/db";

export type AdherentAnniversaire = {
  id: string;
  firstname: string;
  lastname: string;
  dateNaissance: Date;
  image: string | null;
  ageAtNextBirthday: number;
  daysUntilBirthday: number;
  daysFromBirthday: number;
};

type AnniversairesData = {
  spotlight: AdherentAnniversaire[];
  prochains: AdherentAnniversaire[];
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffInDays(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay);
}

function occurrenceForYear(dateNaissance: Date, year: number): Date {
  return new Date(year, dateNaissance.getMonth(), dateNaissance.getDate());
}

function computeBirthdayMeta(dateNaissance: Date, now: Date) {
  const thisYear = now.getFullYear();
  const previousOccurrence = occurrenceForYear(dateNaissance, thisYear - 1);
  const currentOccurrence = occurrenceForYear(dateNaissance, thisYear);
  const nextOccurrence = occurrenceForYear(dateNaissance, thisYear + 1);

  const candidates = [previousOccurrence, currentOccurrence, nextOccurrence];
  const nearestOccurrence = candidates.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(diffInDays(candidate, now));
    const nearestDistance = Math.abs(diffInDays(nearest, now));
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, candidates[0]);

  const upcomingOccurrence = currentOccurrence >= startOfDay(now) ? currentOccurrence : nextOccurrence;
  const years = upcomingOccurrence.getFullYear() - dateNaissance.getFullYear();

  return {
    daysUntilBirthday: diffInDays(now, upcomingOccurrence),
    daysFromBirthday: diffInDays(nearestOccurrence, now),
    ageAtNextBirthday: years,
  };
}

/**
 * Récupère les anniversaires selon la logique métier :
 * - spotlight visible J-1 / J / J+1
 * - liste des prochains anniversaires triée par proximité.
 */
export async function getAnniversairesData(limit = 12): Promise<AnniversairesData> {
  const now = new Date();
  const adherents = await db.adherent.findMany({
    where: {
      dateNaissance: {
        not: null,
      },
    },
    select: {
      id: true,
      firstname: true,
      lastname: true,
      dateNaissance: true,
      User: {
        select: {
          image: true,
        },
      },
    },
  });

  const enriched: AdherentAnniversaire[] = adherents
    .filter((a): a is typeof a & { dateNaissance: Date } => !!a.dateNaissance)
    .map((a) => {
      const meta = computeBirthdayMeta(a.dateNaissance, now);
      return {
        id: a.id,
        firstname: a.firstname,
        lastname: a.lastname,
        dateNaissance: a.dateNaissance,
        image: a.User?.image ?? null,
        ageAtNextBirthday: meta.ageAtNextBirthday,
        daysUntilBirthday: meta.daysUntilBirthday,
        daysFromBirthday: meta.daysFromBirthday,
      };
    });

  const spotlight = enriched
    .filter((a) => a.daysFromBirthday >= -1 && a.daysFromBirthday <= 1)
    .sort((a, b) => a.daysFromBirthday - b.daysFromBirthday);

  const prochains = enriched
    .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)
    .slice(0, limit);

  return { spotlight, prochains };
}
