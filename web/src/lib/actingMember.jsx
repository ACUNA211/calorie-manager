// "Logging for": the Member the signed-in adult is acting as. It is the adult's own Member
// unless they pick one of the Household's Dependents. Screens that show a Member's data
// (Targets now) read it from useActingMember(). The choice lasts for this visit only.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { loadHousehold } from './households.js';

// The people the signed-in adult can log for: themselves first, then each Dependent.
// household is the shape loadHousehold returns (or null).
export function loggingForOptions(household) {
  if (!household) return [];
  const options = [];
  const self = household.members.find((member) => member.id === household.myMemberId);
  if (self) options.push({ id: self.id, name: self.display_name, isSelf: true });
  for (const member of household.members) {
    if (member.role === 'dependent') {
      options.push({ id: member.id, name: member.display_name, isSelf: false });
    }
  }
  return options;
}

// The chosen Member if they are still among the options, otherwise the adult's own Member
// (so a Dependent who was removed while picked falls back to yourself). Null if unknown.
export function resolveActingId(options, chosenId) {
  if (chosenId !== null && options.some((option) => option.id === chosenId)) return chosenId;
  const self = options.find((option) => option.isSelf);
  return self ? self.id : null;
}

const NO_ACTING = {
  actingMemberId: null,
  actingName: null,
  actingIsDependent: false,
  options: [],
  setActingMemberId: () => {},
  refresh: async () => {},
};

const ActingMemberContext = createContext(NO_ACTING);

// Outside the provider (or before the household loads) nothing is acted as, so screens fall
// back to the signed-in person's own Member.
export function useActingMember() {
  return useContext(ActingMemberContext);
}

export function ActingMemberProvider({ children }) {
  const [userId, setUserId] = useState(null);
  // Each state records which user it belongs to, so a sign-out or a new user never shows
  // the last person's Household or choice.
  const [loaded, setLoaded] = useState({ userId: null, household: null });
  const [choice, setChoice] = useState({ userId: null, memberId: null });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data?.session?.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const household = await loadHousehold(supabase, userId);
      setLoaded({ userId, household });
    } catch {
      setLoaded({ userId, household: null });
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) return undefined;
    loadHousehold(supabase, userId)
      .then((household) => {
        if (active) setLoaded({ userId, household });
      })
      .catch(() => {
        if (active) setLoaded({ userId, household: null });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo(() => {
    const household = loaded.userId === userId ? loaded.household : null;
    const options = loggingForOptions(household);
    const chosen = choice.userId === userId ? choice.memberId : null;
    const actingMemberId = resolveActingId(options, chosen);
    const acting = options.find((option) => option.id === actingMemberId) ?? null;
    return {
      actingMemberId,
      actingName: acting ? acting.name : null,
      actingIsDependent: acting !== null && !acting.isSelf,
      options,
      setActingMemberId: (memberId) => setChoice({ userId, memberId }),
      refresh,
    };
  }, [loaded, choice, userId, refresh]);

  return <ActingMemberContext.Provider value={value}>{children}</ActingMemberContext.Provider>;
}
