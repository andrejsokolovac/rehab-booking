"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { supabase } from "@/lib/supabase";

type DatabaseId = number | string;

type Therapist = {
  id: DatabaseId;
  name: string;
  speciality: string;
  isActive: boolean;
};

type TherapistContactEmail = {
  therapistId: DatabaseId;
  email: string;
};

type Service = {
  id: DatabaseId;
  name: string;
  durationMinutes: number;
};

type TherapistServiceAssignment = {
  therapistId: DatabaseId;
  serviceId: DatabaseId;
};

type WorkingHours = {
  therapistId: DatabaseId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type WorkingDayFormValue = {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
};

type NewTherapistValues = {
  name: string;
  speciality: string;
  email: string;
};

type NewServiceValues = {
  name: string;
  durationMinutes: string;
};

const INITIAL_NEW_THERAPIST_VALUES: NewTherapistValues = {
  name: "",
  speciality: "",
  email: "",
};

const INITIAL_NEW_SERVICE_VALUES: NewServiceValues = {
  name: "",
  durationMinutes: "",
};

const WEEK_DAYS = [
  { dayOfWeek: 1, name: "Ponedeljak" },
  { dayOfWeek: 2, name: "Utorak" },
  { dayOfWeek: 3, name: "Sreda" },
  { dayOfWeek: 4, name: "Četvrtak" },
  { dayOfWeek: 5, name: "Petak" },
  { dayOfWeek: 6, name: "Subota" },
  { dayOfWeek: 7, name: "Nedelja" },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SETTINGS_AREAS = [
  {
    title: "Terapeuti",
    description: "Pregled terapeuta i njihovih specijalnosti.",
    available: true,
    href: "#terapeuti",
  },
  {
    title: "Usluge",
    description: "Pregled usluga i trajanja termina.",
    available: true,
    href: "#usluge",
  },
  {
    title: "Usluge terapeuta",
    description: "Pregled usluga dodeljenih terapeutima.",
    available: true,
    href: "#usluge-terapeuta",
  },
  {
    title: "Radno vreme",
    description: "Pregled nedeljnog radnog vremena terapeuta.",
    available: true,
    href: "#radno-vreme",
  },
];

function getDatabaseId(value: unknown): DatabaseId | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return value;
  }

  return null;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getTherapists(data: unknown): Therapist[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const therapists: Therapist[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const id = getDatabaseId(row.id);
    const name = getNonEmptyString(row.name);
    const speciality = getNonEmptyString(row.speciality);
    const isActive = row.is_active;

    if (
      id === null ||
      !name ||
      !speciality ||
      typeof isActive !== "boolean"
    ) {
      return null;
    }

    therapists.push({ id, name, speciality, isActive });
  }

  return therapists;
}

async function loadTherapists() {
  try {
    const { data, error } = await supabase
      .from("therapists")
      .select("id, name, speciality, is_active")
      .order("id", { ascending: true });
    const therapists = getTherapists(data);

    return error || !therapists ? null : therapists;
  } catch {
    return null;
  }
}

function getTherapistContactEmails(
  data: unknown,
): TherapistContactEmail[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const contactEmails: TherapistContactEmail[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const therapistId = getDatabaseId(row.therapist_id);
    const email = getNonEmptyString(row.email);

    if (therapistId === null || !email) {
      return null;
    }

    contactEmails.push({ therapistId, email });
  }

  return contactEmails;
}

async function loadTherapistContactEmails() {
  try {
    const { data, error } = await supabase.rpc(
      "admin_get_therapist_contact_emails",
    );
    const contactEmails = getTherapistContactEmails(data);

    return error || !contactEmails ? null : contactEmails;
  } catch {
    return null;
  }
}

function getServices(data: unknown): Service[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const services: Service[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const id = getDatabaseId(row.id);
    const name = getNonEmptyString(row.name);
    const durationMinutes = row.duration_minutes;

    if (
      id === null ||
      !name ||
      typeof durationMinutes !== "number" ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return null;
    }

    services.push({ id, name, durationMinutes });
  }

  return services;
}

async function loadServices() {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .order("id", { ascending: true });
    const services = getServices(data);

    return error || !services ? null : services;
  } catch {
    return null;
  }
}

function getTherapistServiceAssignments(
  data: unknown,
): TherapistServiceAssignment[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const assignments: TherapistServiceAssignment[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const therapistId = getDatabaseId(row.therapist_id);
    const serviceId = getDatabaseId(row.service_id);

    if (therapistId === null || serviceId === null) {
      return null;
    }

    assignments.push({ therapistId, serviceId });
  }

  return assignments;
}

async function loadTherapistServiceAssignments() {
  try {
    const { data, error } = await supabase
      .from("therapist_services")
      .select("therapist_id, service_id")
      .order("therapist_id", { ascending: true })
      .order("service_id", { ascending: true });
    const assignments = getTherapistServiceAssignments(data);

    return error || !assignments ? null : assignments;
  } catch {
    return null;
  }
}

function getWorkingTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/,
  );

  return match ? `${match[1]}:${match[2]}` : null;
}

function getTimeInMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function getWorkingHours(data: unknown): WorkingHours[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const workingHours: WorkingHours[] = [];

  for (const value of data) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const row = value as Record<string, unknown>;
    const therapistId = getDatabaseId(row.therapist_id);
    const dayOfWeek = row.day_of_week;
    const startTime = getWorkingTime(row.start_time);
    const endTime = getWorkingTime(row.end_time);

    if (
      therapistId === null ||
      typeof dayOfWeek !== "number" ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      !startTime ||
      !endTime
    ) {
      return null;
    }

    workingHours.push({ therapistId, dayOfWeek, startTime, endTime });
  }

  return workingHours;
}

async function loadWorkingHours() {
  try {
    const { data, error } = await supabase
      .from("working_hours")
      .select("therapist_id, day_of_week, start_time, end_time")
      .order("therapist_id", { ascending: true })
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    const workingHours = getWorkingHours(data);

    return error || !workingHours ? null : workingHours;
  } catch {
    return null;
  }
}

async function signOutWithoutThrowing() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Access stays denied even if the remote sign-out request fails.
  }
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const signOutInProgress = useRef(false);
  const therapistCreationInProgress = useRef(false);
  const therapistUpdateInProgress = useRef(false);
  const therapistStatusChangeInProgress = useRef(false);
  const therapistServicesUpdateInProgress = useRef(false);
  const workingHoursUpdateInProgress = useRef(false);
  const serviceCreationInProgress = useRef(false);
  const serviceUpdateInProgress = useRef(false);
  const serviceDeletionInProgress = useRef(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [therapists, setTherapists] = useState<Therapist[]>();
  const [therapistContactEmails, setTherapistContactEmails] =
    useState<TherapistContactEmail[]>();
  const [services, setServices] = useState<Service[]>();
  const [therapistServiceAssignments, setTherapistServiceAssignments] =
    useState<TherapistServiceAssignment[]>();
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>();
  const [pageError, setPageError] = useState<string>();
  const [therapistContactEmailsError, setTherapistContactEmailsError] =
    useState<string>();
  const [servicesError, setServicesError] = useState<string>();
  const [therapistServicesError, setTherapistServicesError] =
    useState<string>();
  const [workingHoursError, setWorkingHoursError] = useState<string>();
  const [workingHoursSuccess, setWorkingHoursSuccess] = useState<string>();
  const [therapistForWorkingHoursEdit, setTherapistForWorkingHoursEdit] =
    useState<Therapist | null>(null);
  const [workingHoursFormValues, setWorkingHoursFormValues] = useState<
    WorkingDayFormValue[]
  >([]);
  const [workingHoursFormErrors, setWorkingHoursFormErrors] = useState<
    Partial<Record<number, string>>
  >({});
  const [workingHoursUpdateError, setWorkingHoursUpdateError] =
    useState<string>();
  const [isUpdatingWorkingHours, setIsUpdatingWorkingHours] = useState(false);
  const [therapistServicesSuccess, setTherapistServicesSuccess] =
    useState<string>();
  const [therapistForServiceEdit, setTherapistForServiceEdit] =
    useState<Therapist | null>(null);
  const [selectedTherapistServiceIds, setSelectedTherapistServiceIds] =
    useState<DatabaseId[]>([]);
  const [therapistServicesUpdateError, setTherapistServicesUpdateError] =
    useState<string>();
  const [isUpdatingTherapistServices, setIsUpdatingTherapistServices] =
    useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [isNewTherapistOpen, setIsNewTherapistOpen] = useState(false);
  const [newTherapistValues, setNewTherapistValues] =
    useState<NewTherapistValues>(INITIAL_NEW_THERAPIST_VALUES);
  const [newTherapistErrors, setNewTherapistErrors] = useState<
    Partial<Record<keyof NewTherapistValues, string>>
  >({});
  const [therapistCreationError, setTherapistCreationError] =
    useState<string>();
  const [therapistSuccess, setTherapistSuccess] = useState<string>();
  const [therapistWarning, setTherapistWarning] = useState<string>();
  const [isCreatingTherapist, setIsCreatingTherapist] = useState(false);
  const [selectedTherapist, setSelectedTherapist] =
    useState<Therapist | null>(null);
  const [editTherapistValues, setEditTherapistValues] =
    useState<NewTherapistValues>(INITIAL_NEW_THERAPIST_VALUES);
  const [editTherapistErrors, setEditTherapistErrors] = useState<
    Partial<Record<keyof NewTherapistValues, string>>
  >({});
  const [therapistUpdateError, setTherapistUpdateError] = useState<string>();
  const [isUpdatingTherapist, setIsUpdatingTherapist] = useState(false);
  const [therapistToDeactivate, setTherapistToDeactivate] =
    useState<Therapist | null>(null);
  const [updatingStatusTherapistId, setUpdatingStatusTherapistId] =
    useState<DatabaseId | null>(null);
  const [therapistStatusError, setTherapistStatusError] = useState<string>();
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [newServiceValues, setNewServiceValues] =
    useState<NewServiceValues>(INITIAL_NEW_SERVICE_VALUES);
  const [newServiceErrors, setNewServiceErrors] = useState<
    Partial<Record<keyof NewServiceValues, string>>
  >({});
  const [serviceCreationError, setServiceCreationError] = useState<string>();
  const [serviceSuccess, setServiceSuccess] = useState<string>();
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editServiceValues, setEditServiceValues] =
    useState<NewServiceValues>(INITIAL_NEW_SERVICE_VALUES);
  const [editServiceErrors, setEditServiceErrors] = useState<
    Partial<Record<keyof NewServiceValues, string>>
  >({});
  const [serviceUpdateError, setServiceUpdateError] = useState<string>();
  const [isUpdatingService, setIsUpdatingService] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [serviceDeletionError, setServiceDeletionError] = useState<string>();
  const [isDeletingService, setIsDeletingService] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function verifyAccessAndLoadSettings() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isActive) {
            router.replace("/staff/login");
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("staff_profiles")
          .select("role, therapist_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || profile?.role !== "admin") {
          await signOutWithoutThrowing();

          if (isActive) {
            router.replace("/staff/login");
          }
          return;
        }

        if (isActive) {
          setIsAuthorized(true);
        }

        const [
          loadedTherapists,
          loadedTherapistContactEmails,
          loadedServices,
          loadedTherapistServiceAssignments,
          loadedWorkingHours,
        ] = await Promise.all([
          loadTherapists(),
          loadTherapistContactEmails(),
          loadServices(),
          loadTherapistServiceAssignments(),
          loadWorkingHours(),
        ]);

        if (isActive) {
          if (loadedTherapists) {
            setTherapists(loadedTherapists);
          } else {
            setPageError(
              "Terapeute trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }

          if (loadedTherapistContactEmails) {
            setTherapistContactEmails(loadedTherapistContactEmails);
          } else {
            setTherapistContactEmailsError(
              "Email adrese terapeuta trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }

          if (loadedServices) {
            setServices(loadedServices);
          } else {
            setServicesError(
              "Usluge trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }

          if (loadedTherapistServiceAssignments) {
            setTherapistServiceAssignments(
              loadedTherapistServiceAssignments,
            );
          } else {
            setTherapistServicesError(
              "Dodeljene usluge trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }

          if (loadedWorkingHours) {
            setWorkingHours(loadedWorkingHours);
          } else {
            setWorkingHoursError(
              "Radno vreme trenutno nije moguće učitati. Pokušajte ponovo kasnije.",
            );
          }
        }
      } catch {
        await signOutWithoutThrowing();

        if (isActive) {
          router.replace("/staff/login");
        }
      }
    }

    void verifyAccessAndLoadSettings();

    return () => {
      isActive = false;
    };
  }, [router]);

  async function refreshTherapistsAndContactEmails() {
    const [refreshedTherapists, refreshedContactEmails] = await Promise.all([
      loadTherapists(),
      loadTherapistContactEmails(),
    ]);

    if (refreshedTherapists) {
      setTherapists(refreshedTherapists);
      setPageError(undefined);
    } else {
      setPageError(
        "Podatke terapeuta trenutno nije moguće osvežiti. Pokušajte ponovo kasnije.",
      );
    }

    if (refreshedContactEmails) {
      setTherapistContactEmails(refreshedContactEmails);
      setTherapistContactEmailsError(undefined);
    } else {
      setTherapistContactEmailsError(
        "Email adrese terapeuta trenutno nije moguće osvežiti. Pokušajte ponovo kasnije.",
      );
    }
  }

  function openNewTherapistForm() {
    setNewTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
    setNewTherapistErrors({});
    setTherapistCreationError(undefined);
    setTherapistSuccess(undefined);
    setTherapistWarning(undefined);
    setIsNewTherapistOpen(true);
  }

  function closeNewTherapistForm() {
    if (therapistCreationInProgress.current) {
      return;
    }

    setIsNewTherapistOpen(false);
    setNewTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
    setNewTherapistErrors({});
    setTherapistCreationError(undefined);
  }

  async function handleNewTherapistSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (therapistCreationInProgress.current) {
      return;
    }

    const name = newTherapistValues.name.trim();
    const speciality = newTherapistValues.speciality.trim();
    const email = newTherapistValues.email.trim();
    const nextErrors: Partial<
      Record<keyof NewTherapistValues, string>
    > = {};

    if (!name) {
      nextErrors.name = "Unesite ime i prezime terapeuta.";
    }

    if (!speciality) {
      nextErrors.speciality = "Unesite specijalnost terapeuta.";
    }

    if (!email) {
      nextErrors.email = "Unesite email za obaveštenja.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Unesite ispravnu email adresu.";
    }

    setNewTherapistErrors(nextErrors);
    setTherapistCreationError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    therapistCreationInProgress.current = true;
    setIsCreatingTherapist(true);
    let therapistCreated = false;

    try {
      const { data, error } = await supabase.rpc("admin_create_therapist", {
        p_name: name,
        p_speciality: speciality,
      });

      if (error) {
        setTherapistCreationError(
          "Terapeuta trenutno nije moguće dodati. Pokušajte ponovo.",
        );
        return;
      }

      therapistCreated = true;
      const newTherapistId = getDatabaseId(data);
      let emailSaved = false;

      if (newTherapistId !== null) {
        const { data: emailResult, error: emailError } = await supabase.rpc(
          "admin_set_therapist_email",
          {
            p_therapist_id: newTherapistId,
            p_email: email,
          },
        );

        emailSaved = !emailError && emailResult === "updated";
      }

      await refreshTherapistsAndContactEmails();

      setIsNewTherapistOpen(false);
      setNewTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
      setNewTherapistErrors({});
      setTherapistCreationError(undefined);

      if (emailSaved) {
        setTherapistSuccess("Novi terapeut je uspešno dodat.");
        setTherapistWarning(undefined);
      } else {
        setTherapistSuccess(undefined);
        setTherapistWarning(
          "Terapeut je dodat, ali email za obaveštenja nije sačuvan. Možete ga podesiti kroz Izmeni.",
        );
      }
    } catch {
      if (therapistCreated) {
        await refreshTherapistsAndContactEmails();
        setIsNewTherapistOpen(false);
        setNewTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
        setNewTherapistErrors({});
        setTherapistCreationError(undefined);
        setTherapistSuccess(undefined);
        setTherapistWarning(
          "Terapeut je dodat, ali email za obaveštenja nije sačuvan. Možete ga podesiti kroz Izmeni.",
        );
      } else {
        setTherapistCreationError(
          "Došlo je do neočekivane greške. Pokušajte ponovo.",
        );
      }
    } finally {
      therapistCreationInProgress.current = false;
      setIsCreatingTherapist(false);
    }
  }

  function openEditTherapistForm(therapist: Therapist) {
    const contactEmail = therapistContactEmails?.find(
      (contact) => String(contact.therapistId) === String(therapist.id),
    )?.email;

    setSelectedTherapist(therapist);
    setEditTherapistValues({
      name: therapist.name,
      speciality: therapist.speciality,
      email: contactEmail ?? "",
    });
    setEditTherapistErrors({});
    setTherapistUpdateError(undefined);
    setTherapistSuccess(undefined);
    setTherapistWarning(undefined);
  }

  function closeEditTherapistForm() {
    if (therapistUpdateInProgress.current) {
      return;
    }

    setSelectedTherapist(null);
    setEditTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
    setEditTherapistErrors({});
    setTherapistUpdateError(undefined);
  }

  async function handleEditTherapistSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (therapistUpdateInProgress.current || !selectedTherapist) {
      return;
    }

    const therapistId = selectedTherapist.id;
    const name = editTherapistValues.name.trim();
    const speciality = editTherapistValues.speciality.trim();
    const email = editTherapistValues.email.trim();
    const nextErrors: Partial<
      Record<keyof NewTherapistValues, string>
    > = {};

    if (!name) {
      nextErrors.name = "Unesite ime i prezime terapeuta.";
    }

    if (!speciality) {
      nextErrors.speciality = "Unesite specijalnost terapeuta.";
    }

    if (!email) {
      nextErrors.email = "Unesite email za obaveštenja.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Unesite ispravnu email adresu.";
    }

    setEditTherapistErrors(nextErrors);
    setTherapistUpdateError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    therapistUpdateInProgress.current = true;
    setIsUpdatingTherapist(true);
    let therapistUpdated = false;

    try {
      const { data, error } = await supabase.rpc("admin_update_therapist", {
        p_therapist_id: therapistId,
        p_name: name,
        p_speciality: speciality,
      });

      if (error || data !== true) {
        setTherapistUpdateError(
          "Podatke terapeuta trenutno nije moguće izmeniti. Pokušajte ponovo.",
        );
        return;
      }

      therapistUpdated = true;
      const { data: emailResult, error: emailError } = await supabase.rpc(
        "admin_set_therapist_email",
        {
          p_therapist_id: therapistId,
          p_email: email,
        },
      );
      const emailSaved = !emailError && emailResult === "updated";

      await refreshTherapistsAndContactEmails();

      setSelectedTherapist(null);
      setEditTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
      setEditTherapistErrors({});
      setTherapistUpdateError(undefined);

      if (emailSaved) {
        setTherapistSuccess("Podaci terapeuta su uspešno izmenjeni.");
        setTherapistWarning(undefined);
      } else {
        setTherapistSuccess(undefined);
        setTherapistWarning(
          "Podaci terapeuta su sačuvani, ali email za obaveštenja nije sačuvan. Pokušajte ponovo kroz Izmeni.",
        );
      }
    } catch {
      if (therapistUpdated) {
        await refreshTherapistsAndContactEmails();
        setSelectedTherapist(null);
        setEditTherapistValues(INITIAL_NEW_THERAPIST_VALUES);
        setEditTherapistErrors({});
        setTherapistUpdateError(undefined);
        setTherapistSuccess(undefined);
        setTherapistWarning(
          "Podaci terapeuta su sačuvani, ali email za obaveštenja nije sačuvan. Pokušajte ponovo kroz Izmeni.",
        );
      } else {
        setTherapistUpdateError(
          "Došlo je do neočekivane greške. Pokušajte ponovo.",
        );
      }
    } finally {
      therapistUpdateInProgress.current = false;
      setIsUpdatingTherapist(false);
    }
  }

  function requestTherapistStatusChange(therapist: Therapist) {
    setTherapistSuccess(undefined);
    setTherapistStatusError(undefined);

    if (therapist.isActive) {
      setTherapistToDeactivate(therapist);
      return;
    }

    void setTherapistActive(therapist, true);
  }

  function closeDeactivationConfirmation() {
    if (therapistStatusChangeInProgress.current) {
      return;
    }

    setTherapistToDeactivate(null);
    setTherapistStatusError(undefined);
  }

  async function setTherapistActive(
    therapist: Therapist,
    isActive: boolean,
  ) {
    if (therapistStatusChangeInProgress.current) {
      return;
    }

    therapistStatusChangeInProgress.current = true;
    setUpdatingStatusTherapistId(therapist.id);
    setTherapistStatusError(undefined);

    try {
      const { data, error } = await supabase.rpc(
        "admin_set_therapist_active",
        {
          p_therapist_id: therapist.id,
          p_is_active: isActive,
        },
      );

      if (error || data !== true) {
        setTherapistStatusError(
          "Status terapeuta trenutno nije moguće promeniti. Pokušajte ponovo.",
        );
        return;
      }

      setTherapists((currentTherapists) =>
        currentTherapists?.map((currentTherapist) =>
          String(currentTherapist.id) === String(therapist.id)
            ? { ...currentTherapist, isActive }
            : currentTherapist,
        ),
      );

      const refreshedTherapists = await loadTherapists();

      if (refreshedTherapists) {
        setTherapists(refreshedTherapists);
        setPageError(undefined);
      }

      setTherapistToDeactivate(null);
      setTherapistSuccess(
        isActive
          ? "Terapeut je uspešno aktiviran."
          : "Terapeut je uspešno deaktiviran.",
      );
    } catch {
      setTherapistStatusError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      therapistStatusChangeInProgress.current = false;
      setUpdatingStatusTherapistId(null);
    }
  }

  function openNewServiceForm() {
    setNewServiceValues(INITIAL_NEW_SERVICE_VALUES);
    setNewServiceErrors({});
    setServiceCreationError(undefined);
    setServiceSuccess(undefined);
    setIsNewServiceOpen(true);
  }

  function closeNewServiceForm() {
    if (serviceCreationInProgress.current) {
      return;
    }

    setIsNewServiceOpen(false);
    setNewServiceValues(INITIAL_NEW_SERVICE_VALUES);
    setNewServiceErrors({});
    setServiceCreationError(undefined);
  }

  async function handleNewServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (serviceCreationInProgress.current) {
      return;
    }

    const name = newServiceValues.name.trim();
    const durationValue = newServiceValues.durationMinutes.trim();
    const durationMinutes = Number(durationValue);
    const nextErrors: Partial<Record<keyof NewServiceValues, string>> = {};

    if (!name) {
      nextErrors.name = "Unesite naziv usluge.";
    }

    if (
      !/^[1-9]\d*$/.test(durationValue) ||
      !Number.isSafeInteger(durationMinutes)
    ) {
      nextErrors.durationMinutes =
        "Trajanje mora biti pozitivan ceo broj minuta.";
    }

    setNewServiceErrors(nextErrors);
    setServiceCreationError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    serviceCreationInProgress.current = true;
    setIsCreatingService(true);

    try {
      const { data, error } = await supabase.rpc("admin_create_service", {
        p_name: name,
        p_duration_minutes: durationMinutes,
      });

      if (error) {
        setServiceCreationError(
          "Uslugu trenutno nije moguće dodati. Pokušajte ponovo.",
        );
        return;
      }

      const newServiceId = getDatabaseId(data);

      if (newServiceId !== null) {
        setServices((currentServices) =>
          currentServices
            ? [
                ...currentServices,
                { id: newServiceId, name, durationMinutes },
              ]
            : currentServices,
        );
      }

      const refreshedServices = await loadServices();

      setIsNewServiceOpen(false);
      setNewServiceValues(INITIAL_NEW_SERVICE_VALUES);
      setNewServiceErrors({});
      setServiceSuccess("Nova usluga je uspešno dodata.");

      if (refreshedServices) {
        setServices(refreshedServices);
        setServicesError(undefined);
      } else if (newServiceId === null) {
        setServicesError(
          "Usluga je dodata, ali osvežavanje liste trenutno nije uspelo.",
        );
      }
    } catch {
      setServiceCreationError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      serviceCreationInProgress.current = false;
      setIsCreatingService(false);
    }
  }

  function openEditServiceForm(service: Service) {
    setSelectedService(service);
    setEditServiceValues({
      name: service.name,
      durationMinutes: String(service.durationMinutes),
    });
    setEditServiceErrors({});
    setServiceUpdateError(undefined);
    setServiceSuccess(undefined);
  }

  function closeEditServiceForm() {
    if (serviceUpdateInProgress.current) {
      return;
    }

    setSelectedService(null);
    setEditServiceValues(INITIAL_NEW_SERVICE_VALUES);
    setEditServiceErrors({});
    setServiceUpdateError(undefined);
  }

  async function handleEditServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (serviceUpdateInProgress.current || !selectedService) {
      return;
    }

    const serviceId = selectedService.id;
    const name = editServiceValues.name.trim();
    const durationValue = editServiceValues.durationMinutes.trim();
    const durationMinutes = Number(durationValue);
    const nextErrors: Partial<Record<keyof NewServiceValues, string>> = {};

    if (!name) {
      nextErrors.name = "Unesite naziv usluge.";
    }

    if (
      !/^[1-9]\d*$/.test(durationValue) ||
      !Number.isSafeInteger(durationMinutes)
    ) {
      nextErrors.durationMinutes =
        "Trajanje mora biti pozitivan ceo broj minuta.";
    }

    setEditServiceErrors(nextErrors);
    setServiceUpdateError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    serviceUpdateInProgress.current = true;
    setIsUpdatingService(true);

    try {
      const { data, error } = await supabase.rpc("admin_update_service", {
        p_service_id: serviceId,
        p_name: name,
        p_duration_minutes: durationMinutes,
      });

      if (error || data !== true) {
        setServiceUpdateError(
          "Podatke usluge trenutno nije moguće izmeniti. Pokušajte ponovo.",
        );
        return;
      }

      setServices((currentServices) =>
        currentServices?.map((service) =>
          String(service.id) === String(serviceId)
            ? { ...service, name, durationMinutes }
            : service,
        ),
      );

      const refreshedServices = await loadServices();

      setSelectedService(null);
      setEditServiceValues(INITIAL_NEW_SERVICE_VALUES);
      setEditServiceErrors({});
      setServiceSuccess("Podaci usluge su uspešno izmenjeni.");

      if (refreshedServices) {
        setServices(refreshedServices);
        setServicesError(undefined);
      }
    } catch {
      setServiceUpdateError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      serviceUpdateInProgress.current = false;
      setIsUpdatingService(false);
    }
  }

  function openDeleteServiceConfirmation(service: Service) {
    setServiceToDelete(service);
    setServiceDeletionError(undefined);
    setServiceSuccess(undefined);
  }

  function closeDeleteServiceConfirmation() {
    if (serviceDeletionInProgress.current) {
      return;
    }

    setServiceToDelete(null);
    setServiceDeletionError(undefined);
  }

  async function handleDeleteService() {
    if (serviceDeletionInProgress.current || !serviceToDelete) {
      return;
    }

    const serviceId = serviceToDelete.id;
    serviceDeletionInProgress.current = true;
    setIsDeletingService(true);
    setServiceDeletionError(undefined);

    try {
      const { data, error } = await supabase.rpc("admin_delete_service", {
        p_service_id: serviceId,
      });

      if (error) {
        setServiceDeletionError(
          "Uslugu trenutno nije moguće obrisati. Pokušajte ponovo.",
        );
        return;
      }

      if (data === "in_use") {
        setServiceDeletionError(
          "Usluga se ne može obrisati jer je već korišćena u terminima ili listi čekanja.",
        );
        return;
      }

      if (data !== "deleted") {
        setServiceDeletionError(
          "Usluga nije dostupna ili više ne postoji. Osvežite stranicu i pokušajte ponovo.",
        );
        return;
      }

      setServices((currentServices) =>
        currentServices?.filter(
          (service) => String(service.id) !== String(serviceId),
        ),
      );
      setServiceToDelete(null);
      setServiceDeletionError(undefined);
      setServiceSuccess("Usluga je obrisana.");

      const refreshedServices = await loadServices();

      if (refreshedServices) {
        setServices(refreshedServices);
        setServicesError(undefined);
      }
    } catch {
      setServiceDeletionError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      serviceDeletionInProgress.current = false;
      setIsDeletingService(false);
    }
  }

  function openTherapistServicesEditor(therapist: Therapist) {
    const assignedServiceIds =
      therapistServiceAssignments
        ?.filter(
          (assignment) =>
            String(assignment.therapistId) === String(therapist.id),
        )
        .map((assignment) => assignment.serviceId) ?? [];

    setTherapistForServiceEdit(therapist);
    setSelectedTherapistServiceIds(assignedServiceIds);
    setTherapistServicesUpdateError(undefined);
    setTherapistServicesSuccess(undefined);
  }

  function closeTherapistServicesEditor() {
    if (therapistServicesUpdateInProgress.current) {
      return;
    }

    setTherapistForServiceEdit(null);
    setSelectedTherapistServiceIds([]);
    setTherapistServicesUpdateError(undefined);
  }

  function toggleTherapistService(serviceId: DatabaseId) {
    setSelectedTherapistServiceIds((currentServiceIds) => {
      const isSelected = currentServiceIds.some(
        (currentServiceId) => String(currentServiceId) === String(serviceId),
      );

      return isSelected
        ? currentServiceIds.filter(
            (currentServiceId) =>
              String(currentServiceId) !== String(serviceId),
          )
        : [...currentServiceIds, serviceId];
    });
    setTherapistServicesUpdateError(undefined);
  }

  async function handleTherapistServicesSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      therapistServicesUpdateInProgress.current ||
      !therapistForServiceEdit
    ) {
      return;
    }

    const therapistId = therapistForServiceEdit.id;
    const serviceIds = [...selectedTherapistServiceIds];
    therapistServicesUpdateInProgress.current = true;
    setIsUpdatingTherapistServices(true);
    setTherapistServicesUpdateError(undefined);

    try {
      const { data, error } = await supabase.rpc(
        "admin_set_therapist_services",
        {
          p_therapist_id: therapistId,
          p_service_ids: serviceIds,
        },
      );

      if (error || data !== true) {
        setTherapistServicesUpdateError(
          "Dodeljene usluge trenutno nije moguće izmeniti. Pokušajte ponovo.",
        );
        return;
      }

      setTherapistServiceAssignments((currentAssignments) => [
        ...(currentAssignments?.filter(
          (assignment) =>
            String(assignment.therapistId) !== String(therapistId),
        ) ?? []),
        ...serviceIds.map((serviceId) => ({ therapistId, serviceId })),
      ]);

      const refreshedAssignments = await loadTherapistServiceAssignments();

      setTherapistForServiceEdit(null);
      setSelectedTherapistServiceIds([]);
      setTherapistServicesUpdateError(undefined);
      setTherapistServicesSuccess("Usluge terapeuta su uspešno sačuvane.");

      if (refreshedAssignments) {
        setTherapistServiceAssignments(refreshedAssignments);
        setTherapistServicesError(undefined);
      }
    } catch {
      setTherapistServicesUpdateError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      therapistServicesUpdateInProgress.current = false;
      setIsUpdatingTherapistServices(false);
    }
  }

  function openWorkingHoursEditor(therapist: Therapist) {
    const therapistWorkingHours =
      workingHours?.filter(
        (workingHour) =>
          String(workingHour.therapistId) === String(therapist.id),
      ) ?? [];

    setTherapistForWorkingHoursEdit(therapist);
    setWorkingHoursFormValues(
      WEEK_DAYS.map((day) => {
        const existingWorkingHours = therapistWorkingHours.find(
          (workingHour) => workingHour.dayOfWeek === day.dayOfWeek,
        );

        return {
          dayOfWeek: day.dayOfWeek,
          isWorking: Boolean(existingWorkingHours),
          startTime: existingWorkingHours?.startTime ?? "08:00",
          endTime: existingWorkingHours?.endTime ?? "16:00",
        };
      }),
    );
    setWorkingHoursFormErrors({});
    setWorkingHoursUpdateError(undefined);
    setWorkingHoursSuccess(undefined);
  }

  function closeWorkingHoursEditor() {
    if (workingHoursUpdateInProgress.current) {
      return;
    }

    setTherapistForWorkingHoursEdit(null);
    setWorkingHoursFormValues([]);
    setWorkingHoursFormErrors({});
    setWorkingHoursUpdateError(undefined);
  }

  function updateWorkingDay(
    dayOfWeek: number,
    changes: Partial<Omit<WorkingDayFormValue, "dayOfWeek">>,
  ) {
    setWorkingHoursFormValues((currentValues) =>
      currentValues.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day,
      ),
    );
    setWorkingHoursFormErrors((currentErrors) => ({
      ...currentErrors,
      [dayOfWeek]: undefined,
    }));
    setWorkingHoursUpdateError(undefined);
  }

  async function handleWorkingHoursSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      workingHoursUpdateInProgress.current ||
      !therapistForWorkingHoursEdit
    ) {
      return;
    }

    const nextErrors: Partial<Record<number, string>> = {};

    for (const day of workingHoursFormValues) {
      if (!day.isWorking) {
        continue;
      }

      const startMinutes = getTimeInMinutes(day.startTime);
      const endMinutes = getTimeInMinutes(day.endTime);

      if (startMinutes === null || endMinutes === null) {
        nextErrors[day.dayOfWeek] = "Unesite ispravno početno i završno vreme.";
      } else if (startMinutes >= endMinutes) {
        nextErrors[day.dayOfWeek] =
          "Početno vreme mora biti pre završnog vremena.";
      }
    }

    setWorkingHoursFormErrors(nextErrors);
    setWorkingHoursUpdateError(undefined);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const therapistId = therapistForWorkingHoursEdit.id;
    const schedule = workingHoursFormValues
      .filter((day) => day.isWorking)
      .map((day) => ({
        day_of_week: day.dayOfWeek,
        start_time: day.startTime,
        end_time: day.endTime,
      }));

    workingHoursUpdateInProgress.current = true;
    setIsUpdatingWorkingHours(true);

    try {
      const { data, error } = await supabase.rpc(
        "admin_set_therapist_working_hours",
        {
          p_therapist_id: therapistId,
          p_schedule: schedule,
        },
      );

      if (error) {
        setWorkingHoursUpdateError(
          "Radno vreme trenutno nije moguće sačuvati. Pokušajte ponovo.",
        );
        return;
      }

      if (data === "appointment_conflict") {
        setWorkingHoursUpdateError(
          "Radno vreme nije moguće sačuvati jer postoje budući zakazani termini koji bi ostali van novog radnog vremena.",
        );
        return;
      }

      if (data !== "updated") {
        setWorkingHoursUpdateError(
          "Terapeut nije dostupan ili više ne postoji. Osvežite stranicu i pokušajte ponovo.",
        );
        return;
      }

      setWorkingHours((currentWorkingHours) => [
        ...(currentWorkingHours?.filter(
          (workingHour) =>
            String(workingHour.therapistId) !== String(therapistId),
        ) ?? []),
        ...schedule.map((day) => ({
          therapistId,
          dayOfWeek: day.day_of_week,
          startTime: day.start_time,
          endTime: day.end_time,
        })),
      ]);

      const refreshedWorkingHours = await loadWorkingHours();

      setTherapistForWorkingHoursEdit(null);
      setWorkingHoursFormValues([]);
      setWorkingHoursFormErrors({});
      setWorkingHoursUpdateError(undefined);
      setWorkingHoursSuccess("Radno vreme je uspešno sačuvano.");

      if (refreshedWorkingHours) {
        setWorkingHours(refreshedWorkingHours);
        setWorkingHoursError(undefined);
      }
    } catch {
      setWorkingHoursUpdateError(
        "Došlo je do neočekivane greške. Pokušajte ponovo.",
      );
    } finally {
      workingHoursUpdateInProgress.current = false;
      setIsUpdatingWorkingHours(false);
    }
  }

  async function handleSignOut() {
    if (signOutInProgress.current) {
      return;
    }

    signOutInProgress.current = true;
    setIsSigningOut(true);
    setSignOutError(undefined);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError("Odjava trenutno nije moguća. Pokušajte ponovo.");
        return;
      }

      router.replace("/staff/login");
      router.refresh();
    } catch {
      setSignOutError("Došlo je do neočekivane greške pri odjavi.");
    } finally {
      signOutInProgress.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#fffaf3] text-[#243c38]">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#e2f0e7] sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-[#f9dfcb] sm:h-80 sm:w-80"
      />

      <header className="sticky top-0 z-40 border-b border-[#243c38]/8 bg-[#fffaf3]/95 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#397267]"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#397267] text-lg font-semibold text-white shadow-sm"
            >
              C
            </span>
            <span className="hidden text-sm leading-snug font-semibold tracking-tight text-[#243c38] sm:block sm:text-base">
              Centar za razvoj i rehabilitaciju
            </span>
          </Link>

          {isAuthorized && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#397267]/20 bg-white/75 px-4 py-2.5 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] sm:px-5"
              >
                Nazad na kalendar
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                aria-busy={isSigningOut}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-[#397267]/20 bg-white/75 px-4 py-2.5 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-65 sm:px-5"
              >
                {isSigningOut ? "Odjavljivanje..." : "Odjavi se"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 sm:py-16 lg:px-10">
          {!isAuthorized ? (
            <div
              role="status"
              className="mx-auto mt-16 max-w-md rounded-3xl border border-[#397267]/12 bg-white/80 p-8 text-center shadow-[0_14px_38px_rgba(36,60,56,0.07)]"
            >
              <p className="font-semibold text-[#243c38]">Provera pristupa...</p>
              <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                Molimo sačekajte trenutak.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Admin panel
                </p>
                <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#243c38] sm:text-5xl">
                  Podešavanja
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#6b807c]">
                  Pregled osnovnih podataka i budućih podešavanja centra.
                </p>
              </div>

              {signOutError && (
                <div
                  role="alert"
                  className="mt-6 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium text-[#8f4033]"
                >
                  {signOutError}
                </div>
              )}

              <nav
                aria-label="Oblasti podešavanja"
                className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {SETTINGS_AREAS.map((area) =>
                  area.available ? (
                    <a
                      key={area.title}
                      href={area.href}
                      className="rounded-3xl border border-[#397267]/20 bg-white/85 p-5 shadow-[0_12px_34px_rgba(36,60,56,0.06)] transition hover:-translate-y-0.5 hover:border-[#397267]/35 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                    >
                      <span className="text-lg font-semibold text-[#243c38]">
                        {area.title}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-[#6b807c]">
                        {area.description}
                      </span>
                    </a>
                  ) : (
                    <div
                      key={area.title}
                      aria-disabled="true"
                      className="rounded-3xl border border-[#397267]/10 bg-white/55 p-5 text-[#6b807c]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-lg font-semibold text-[#526b66]">
                          {area.title}
                        </span>
                        <span className="rounded-full bg-[#edf5f0] px-2.5 py-1 text-xs font-semibold text-[#397267]">
                          Uskoro
                        </span>
                      </div>
                      <span className="mt-2 block text-sm leading-6">
                        {area.description}
                      </span>
                    </div>
                  ),
                )}
              </nav>

              <section
                id="terapeuti"
                aria-labelledby="therapists-title"
                className="mt-12 scroll-mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                      Pregled
                    </p>
                    <h2
                      id="therapists-title"
                      className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                    >
                      Terapeuti
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                      Trenutno evidentirani terapeuti i njihove specijalnosti.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewTherapistForm}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#397267] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(57,114,103,0.2)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                  >
                    + Novi terapeut
                  </button>
                </div>

                {therapistSuccess && (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/18 bg-[#edf7f1] px-5 py-4 text-sm font-medium text-[#2f6158]"
                  >
                    {therapistSuccess}
                  </div>
                )}

                {therapistWarning && (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#c78a32]/25 bg-[#fff8e8] px-5 py-4 text-sm font-medium leading-6 text-[#805b24]"
                  >
                    {therapistWarning}
                  </div>
                )}

                {therapistContactEmailsError && (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium text-[#8f4033]"
                  >
                    {therapistContactEmailsError}
                  </div>
                )}

                {therapistStatusError && !therapistToDeactivate && (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-4 text-sm font-medium text-[#8f4033]"
                  >
                    {therapistStatusError}
                  </div>
                )}

                {pageError ? (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-5 text-sm text-[#8f4033]"
                  >
                    {pageError}
                  </div>
                ) : therapists === undefined ? (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm font-medium text-[#526b66]"
                  >
                    Učitavanje terapeuta...
                  </div>
                ) : therapists.length === 0 ? (
                  <div className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm text-[#526b66]">
                    Trenutno nema evidentiranih terapeuta.
                  </div>
                ) : (
                  <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {therapists.map((therapist) => {
                      return (
                        <li
                          key={String(therapist.id)}
                          className="flex flex-col rounded-2xl border border-[#397267]/12 bg-[#fffdf9] p-5"
                        >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-lg font-semibold text-[#243c38]">
                            {therapist.name}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              therapist.isActive
                                ? "bg-[#dceee5] text-[#2f6158]"
                                : "bg-[#ececea] text-[#6b706e]"
                            }`}
                          >
                            {therapist.isActive ? "Aktivan" : "Neaktivan"}
                          </span>
                        </div>
                          <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                            {therapist.speciality}
                          </p>
                          <div className="mt-auto flex flex-wrap gap-2 pt-5">
                          <button
                            type="button"
                            onClick={() => openEditTherapistForm(therapist)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#397267]/20 bg-white px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                          >
                            Izmeni
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestTherapistStatusChange(therapist)
                            }
                            disabled={updatingStatusTherapistId !== null}
                            aria-busy={
                              updatingStatusTherapistId !== null &&
                              String(updatingStatusTherapistId) ===
                                String(therapist.id)
                            }
                            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-55 ${
                              therapist.isActive
                                ? "border-[#b45745]/22 bg-[#fff8f5] text-[#a34838] hover:border-[#b45745]/40 hover:bg-[#f9e8e2] focus-visible:outline-[#b45745]"
                                : "border-[#397267]/20 bg-[#edf7f1] text-[#2f6158] hover:border-[#397267]/35 hover:bg-[#e1f0e8] focus-visible:outline-[#397267]"
                            }`}
                          >
                            {updatingStatusTherapistId !== null &&
                            String(updatingStatusTherapistId) ===
                              String(therapist.id)
                              ? therapist.isActive
                                ? "Deaktiviranje..."
                                : "Aktiviranje..."
                              : therapist.isActive
                                ? "Deaktiviraj"
                                : "Aktiviraj"}
                          </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section
                id="usluge"
                aria-labelledby="services-title"
                className="mt-8 scroll-mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                      Pregled
                    </p>
                    <h2
                      id="services-title"
                      className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                    >
                      Usluge
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                      Trenutno dostupne usluge centra i trajanje termina.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewServiceForm}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#397267] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(57,114,103,0.2)] transition hover:bg-[#2f6158] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                  >
                    + Nova usluga
                  </button>
                </div>

                {serviceSuccess && (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/18 bg-[#edf7f1] px-5 py-4 text-sm font-medium text-[#2f6158]"
                  >
                    {serviceSuccess}
                  </div>
                )}

                {servicesError ? (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-5 text-sm text-[#8f4033]"
                  >
                    {servicesError}
                  </div>
                ) : services === undefined ? (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm font-medium text-[#526b66]"
                  >
                    Učitavanje usluga...
                  </div>
                ) : services.length === 0 ? (
                  <div className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm text-[#526b66]">
                    Trenutno nema evidentiranih usluga.
                  </div>
                ) : (
                  <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {services.map((service) => (
                      <li
                        key={String(service.id)}
                        className="flex flex-col rounded-2xl border border-[#397267]/12 bg-[#fffdf9] p-5"
                      >
                        <p className="text-lg font-semibold text-[#243c38]">
                          {service.name}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#397267]">
                          {service.durationMinutes} min
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditServiceForm(service)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#397267]/20 bg-white px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                          >
                            Izmeni
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteServiceConfirmation(service)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#b45745]/25 bg-white px-4 py-2 text-sm font-semibold text-[#a34838] transition hover:border-[#b45745]/40 hover:bg-[#fff4f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#b45745]"
                          >
                            Obriši
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                id="usluge-terapeuta"
                aria-labelledby="therapist-services-title"
                className="mt-8 scroll-mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
              >
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                    Pregled
                  </p>
                  <h2
                    id="therapist-services-title"
                    className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                  >
                    Usluge terapeuta
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                    Trenutne usluge dodeljene svakom terapeutu.
                  </p>
                </div>

                {therapistServicesSuccess && (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/18 bg-[#edf7f1] px-5 py-4 text-sm font-medium text-[#2f6158]"
                  >
                    {therapistServicesSuccess}
                  </div>
                )}

                {therapistServicesError || pageError || servicesError ? (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-5 text-sm text-[#8f4033]"
                  >
                    {therapistServicesError ??
                      "Dodeljene usluge trenutno nije moguće prikazati. Pokušajte ponovo kasnije."}
                  </div>
                ) : therapists === undefined ||
                  services === undefined ||
                  therapistServiceAssignments === undefined ? (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm font-medium text-[#526b66]"
                  >
                    Učitavanje dodeljenih usluga...
                  </div>
                ) : therapists.length === 0 ? (
                  <div className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm text-[#526b66]">
                    Trenutno nema evidentiranih terapeuta.
                  </div>
                ) : (
                  <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {therapists.map((therapist) => {
                      const assignedServiceIds = new Set(
                        therapistServiceAssignments
                          .filter(
                            (assignment) =>
                              String(assignment.therapistId) ===
                              String(therapist.id),
                          )
                          .map((assignment) => String(assignment.serviceId)),
                      );
                      const assignedServices = services.filter((service) =>
                        assignedServiceIds.has(String(service.id)),
                      );

                      return (
                        <li
                          key={String(therapist.id)}
                          className="flex flex-col rounded-2xl border border-[#397267]/12 bg-[#fffdf9] p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-[#243c38]">
                                {therapist.name}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[#6b807c]">
                                {therapist.speciality}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                therapist.isActive
                                  ? "bg-[#dceee5] text-[#2f6158]"
                                  : "bg-[#ececea] text-[#6b706e]"
                              }`}
                            >
                              {therapist.isActive ? "Aktivan" : "Neaktivan"}
                            </span>
                          </div>

                          {assignedServices.length === 0 ? (
                            <p className="mt-5 rounded-xl bg-[#f4f8f7] px-4 py-3 text-sm text-[#6b807c]">
                              Nema dodeljenih usluga.
                            </p>
                          ) : (
                            <ul className="mt-5 space-y-2 border-t border-[#397267]/10 pt-4">
                              {assignedServices.map((service) => (
                                <li
                                  key={String(service.id)}
                                  className="flex items-start gap-2 text-sm font-medium leading-6 text-[#3f5954]"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#79a59b]"
                                  />
                                  <span>{service.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              openTherapistServicesEditor(therapist)
                            }
                            className="mt-5 inline-flex min-h-10 items-center justify-center self-start rounded-full border border-[#397267]/20 bg-white px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                          >
                            Izmeni usluge
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section
                id="radno-vreme"
                aria-labelledby="working-hours-title"
                className="mt-8 scroll-mt-8 rounded-3xl border border-[#397267]/12 bg-white/80 p-6 shadow-[0_14px_38px_rgba(36,60,56,0.07)] sm:p-8"
              >
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                    Pregled
                  </p>
                  <h2
                    id="working-hours-title"
                    className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                  >
                    Radno vreme
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6b807c]">
                    Nedeljni raspored rada svih terapeuta.
                  </p>
                </div>

                {workingHoursSuccess && (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/18 bg-[#edf7f1] px-5 py-4 text-sm font-medium text-[#2f6158]"
                  >
                    {workingHoursSuccess}
                  </div>
                )}

                {workingHoursError || pageError ? (
                  <div
                    role="alert"
                    className="mt-7 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-5 py-5 text-sm text-[#8f4033]"
                  >
                    {workingHoursError ??
                      "Radno vreme trenutno nije moguće prikazati. Pokušajte ponovo kasnije."}
                  </div>
                ) : therapists === undefined || workingHours === undefined ? (
                  <div
                    role="status"
                    className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm font-medium text-[#526b66]"
                  >
                    Učitavanje radnog vremena...
                  </div>
                ) : therapists.length === 0 ? (
                  <div className="mt-7 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-5 py-7 text-center text-sm text-[#526b66]">
                    Trenutno nema evidentiranih terapeuta.
                  </div>
                ) : (
                  <ul className="mt-7 grid gap-4 lg:grid-cols-2">
                    {therapists.map((therapist) => {
                      const therapistWorkingHours = workingHours.filter(
                        (workingHour) =>
                          String(workingHour.therapistId) ===
                          String(therapist.id),
                      );

                      return (
                        <li
                          key={String(therapist.id)}
                          className="rounded-2xl border border-[#397267]/12 bg-[#fffdf9] p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-lg font-semibold text-[#243c38]">
                              {therapist.name}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                therapist.isActive
                                  ? "bg-[#dceee5] text-[#2f6158]"
                                  : "bg-[#ececea] text-[#6b706e]"
                              }`}
                            >
                              {therapist.isActive ? "Aktivan" : "Neaktivan"}
                            </span>
                          </div>

                          <ul className="mt-5 divide-y divide-[#397267]/8 border-t border-[#397267]/10">
                            {WEEK_DAYS.map((day) => {
                              const dayWorkingHours =
                                therapistWorkingHours.filter(
                                  (workingHour) =>
                                    workingHour.dayOfWeek === day.dayOfWeek,
                                );

                              return (
                                <li
                                  key={day.dayOfWeek}
                                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5 text-sm"
                                >
                                  <span className="font-medium text-[#3f5954]">
                                    {day.name}
                                  </span>
                                  {dayWorkingHours.length === 0 ? (
                                    <span className="text-[#899794]">
                                      Ne radi
                                    </span>
                                  ) : (
                                    <span className="flex flex-col items-end gap-1 font-semibold whitespace-nowrap text-[#397267] tabular-nums">
                                      {dayWorkingHours.map(
                                        (workingHour, index) => (
                                          <span
                                            key={`${workingHour.startTime}-${workingHour.endTime}-${index}`}
                                          >
                                            {workingHour.startTime} –{" "}
                                            {workingHour.endTime}
                                          </span>
                                        ),
                                      )}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <button
                            type="button"
                            onClick={() => openWorkingHoursEditor(therapist)}
                            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-[#397267]/20 bg-white px-4 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#397267]"
                          >
                            Izmeni radno vreme
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </section>
      </main>

      {isNewServiceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeNewServiceForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-service-title"
            className="w-full max-w-lg rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Usluge
                </p>
                <h2
                  id="new-service-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Nova usluga
                </h2>
              </div>
              <button
                type="button"
                onClick={closeNewServiceForm}
                disabled={isCreatingService}
                aria-label="Zatvori formu za novu uslugu"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              noValidate
              onSubmit={handleNewServiceSubmit}
              className="mt-7"
            >
              <div>
                <label
                  htmlFor="new-service-name"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Naziv usluge <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="new-service-name"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  required
                  value={newServiceValues.name}
                  onChange={(event) => {
                    setNewServiceValues((currentValues) => ({
                      ...currentValues,
                      name: event.target.value,
                    }));
                    setNewServiceErrors((currentErrors) => ({
                      ...currentErrors,
                      name: undefined,
                    }));
                    setServiceCreationError(undefined);
                  }}
                  disabled={isCreatingService}
                  aria-invalid={Boolean(newServiceErrors.name)}
                  aria-describedby={
                    newServiceErrors.name ? "new-service-name-error" : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    newServiceErrors.name
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {newServiceErrors.name && (
                  <p
                    id="new-service-name-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {newServiceErrors.name}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="new-service-duration"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Trajanje termina (min){" "}
                  <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="new-service-duration"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  required
                  value={newServiceValues.durationMinutes}
                  onChange={(event) => {
                    setNewServiceValues((currentValues) => ({
                      ...currentValues,
                      durationMinutes: event.target.value,
                    }));
                    setNewServiceErrors((currentErrors) => ({
                      ...currentErrors,
                      durationMinutes: undefined,
                    }));
                    setServiceCreationError(undefined);
                  }}
                  disabled={isCreatingService}
                  aria-invalid={Boolean(newServiceErrors.durationMinutes)}
                  aria-describedby={
                    newServiceErrors.durationMinutes
                      ? "new-service-duration-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    newServiceErrors.durationMinutes
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {newServiceErrors.durationMinutes && (
                  <p
                    id="new-service-duration-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {newServiceErrors.durationMinutes}
                  </p>
                )}
              </div>

              {serviceCreationError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {serviceCreationError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeNewServiceForm}
                  disabled={isCreatingService}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isCreatingService}
                  aria-busy={isCreatingService}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isCreatingService ? "Dodavanje..." : "Dodaj uslugu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditServiceForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-title"
            className="w-full max-w-lg rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Usluge
                </p>
                <h2
                  id="edit-service-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Izmeni uslugu
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditServiceForm}
                disabled={isUpdatingService}
                aria-label="Zatvori formu za izmenu usluge"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              noValidate
              onSubmit={handleEditServiceSubmit}
              className="mt-7"
            >
              <div>
                <label
                  htmlFor="edit-service-name"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Naziv usluge <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="edit-service-name"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  required
                  value={editServiceValues.name}
                  onChange={(event) => {
                    setEditServiceValues((currentValues) => ({
                      ...currentValues,
                      name: event.target.value,
                    }));
                    setEditServiceErrors((currentErrors) => ({
                      ...currentErrors,
                      name: undefined,
                    }));
                    setServiceUpdateError(undefined);
                  }}
                  disabled={isUpdatingService}
                  aria-invalid={Boolean(editServiceErrors.name)}
                  aria-describedby={
                    editServiceErrors.name
                      ? "edit-service-name-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    editServiceErrors.name
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {editServiceErrors.name && (
                  <p
                    id="edit-service-name-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {editServiceErrors.name}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="edit-service-duration"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Trajanje termina (min){" "}
                  <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="edit-service-duration"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  required
                  value={editServiceValues.durationMinutes}
                  onChange={(event) => {
                    setEditServiceValues((currentValues) => ({
                      ...currentValues,
                      durationMinutes: event.target.value,
                    }));
                    setEditServiceErrors((currentErrors) => ({
                      ...currentErrors,
                      durationMinutes: undefined,
                    }));
                    setServiceUpdateError(undefined);
                  }}
                  disabled={isUpdatingService}
                  aria-invalid={Boolean(editServiceErrors.durationMinutes)}
                  aria-describedby={
                    editServiceErrors.durationMinutes
                      ? "edit-service-duration-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    editServiceErrors.durationMinutes
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {editServiceErrors.durationMinutes && (
                  <p
                    id="edit-service-duration-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {editServiceErrors.durationMinutes}
                  </p>
                )}
              </div>

              {serviceUpdateError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {serviceUpdateError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditServiceForm}
                  disabled={isUpdatingService}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingService}
                  aria-busy={isUpdatingService}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingService ? "Čuvanje..." : "Sačuvaj izmene"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {serviceToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteServiceConfirmation();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-service-title"
            aria-describedby="delete-service-description"
            className="w-full max-w-lg rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <p className="text-xs font-semibold tracking-[0.12em] text-[#a34838] uppercase">
              Trajno brisanje
            </p>
            <h2
              id="delete-service-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
            >
              Da li ste sigurni da želite da obrišete ovu uslugu?
            </h2>
            <p
              id="delete-service-description"
              className="mt-4 text-sm leading-6 text-[#526b66]"
            >
              Usluga „{serviceToDelete.name}” biće trajno obrisana ako nije
              korišćena u terminima ili listi čekanja. Ovu radnju nije moguće
              poništiti.
            </p>

            {serviceDeletionError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
              >
                {serviceDeletionError}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteServiceConfirmation}
                disabled={isDeletingService}
                className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={handleDeleteService}
                disabled={isDeletingService}
                aria-busy={isDeletingService}
                className="min-h-11 rounded-full bg-[#a34838] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(163,72,56,0.22)] transition hover:bg-[#8f4033] disabled:cursor-wait disabled:opacity-60"
              >
                {isDeletingService ? "Brisanje..." : "Potvrdi brisanje"}
              </button>
            </div>
          </div>
        </div>
      )}

      {therapistForServiceEdit && services && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTherapistServicesEditor();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-therapist-services-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Usluge terapeuta
                </p>
                <h2
                  id="edit-therapist-services-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Izmeni usluge
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#526b66]">
                  {therapistForServiceEdit.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTherapistServicesEditor}
                disabled={isUpdatingTherapistServices}
                aria-label="Zatvori izmenu usluga terapeuta"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleTherapistServicesSubmit}
              className="mt-7"
            >
              <fieldset disabled={isUpdatingTherapistServices}>
                <legend className="text-sm font-semibold text-[#243c38]">
                  Dodeljene usluge
                </legend>

                {services.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-[#397267]/12 bg-[#f4f8f7] px-4 py-4 text-sm text-[#6b807c]">
                    Trenutno nema evidentiranih usluga. Možete sačuvati praznu
                    listu.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {services.map((service) => {
                      const isChecked = selectedTherapistServiceIds.some(
                        (serviceId) =>
                          String(serviceId) === String(service.id),
                      );

                      return (
                        <label
                          key={String(service.id)}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#397267]/12 bg-[#fffdf9] px-4 py-3 transition hover:border-[#397267]/28 hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              toggleTherapistService(service.id)
                            }
                            className="mt-1 h-4 w-4 shrink-0 accent-[#397267]"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-[#243c38]">
                              {service.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#6b807c]">
                              {service.durationMinutes} min
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              {therapistServicesUpdateError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {therapistServicesUpdateError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeTherapistServicesEditor}
                  disabled={isUpdatingTherapistServices}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTherapistServices}
                  aria-busy={isUpdatingTherapistServices}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingTherapistServices
                    ? "Čuvanje..."
                    : "Sačuvaj usluge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {therapistForWorkingHoursEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeWorkingHoursEditor();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-working-hours-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Radno vreme
                </p>
                <h2
                  id="edit-working-hours-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Izmeni radno vreme
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#526b66]">
                  {therapistForWorkingHoursEdit.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWorkingHoursEditor}
                disabled={isUpdatingWorkingHours}
                aria-label="Zatvori izmenu radnog vremena"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              noValidate
              onSubmit={handleWorkingHoursSubmit}
              className="mt-7"
            >
              <fieldset
                disabled={isUpdatingWorkingHours}
                className="space-y-3"
              >
                <legend className="sr-only">Nedeljni raspored</legend>
                {workingHoursFormValues.map((day) => {
                  const dayName =
                    WEEK_DAYS.find(
                      (weekDay) => weekDay.dayOfWeek === day.dayOfWeek,
                    )?.name ?? "Dan";
                  const dayError = workingHoursFormErrors[day.dayOfWeek];

                  return (
                    <div
                      key={day.dayOfWeek}
                      className="rounded-2xl border border-[#397267]/12 bg-[#fffdf9] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <span className="min-w-28 text-sm font-semibold text-[#243c38]">
                            {dayName}
                          </span>
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#397267]">
                            <input
                              type="checkbox"
                              checked={day.isWorking}
                              onChange={(event) =>
                                updateWorkingDay(day.dayOfWeek, {
                                  isWorking: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[#397267]"
                            />
                            Radi
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:w-64">
                          <label className="text-xs font-semibold text-[#526b66]">
                            Od
                            <input
                              type="time"
                              required={day.isWorking}
                              disabled={!day.isWorking}
                              value={day.startTime}
                              onChange={(event) =>
                                updateWorkingDay(day.dayOfWeek, {
                                  startTime: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(dayError)}
                              className="mt-1 min-h-10 w-full rounded-xl border border-[#397267]/18 bg-white px-3 py-2 text-sm text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-not-allowed disabled:bg-[#ecefed] disabled:text-[#899794]"
                            />
                          </label>
                          <label className="text-xs font-semibold text-[#526b66]">
                            Do
                            <input
                              type="time"
                              required={day.isWorking}
                              disabled={!day.isWorking}
                              value={day.endTime}
                              onChange={(event) =>
                                updateWorkingDay(day.dayOfWeek, {
                                  endTime: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(dayError)}
                              className="mt-1 min-h-10 w-full rounded-xl border border-[#397267]/18 bg-white px-3 py-2 text-sm text-[#243c38] outline-none transition focus:border-[#397267]/45 focus:ring-3 focus:ring-[#397267]/12 disabled:cursor-not-allowed disabled:bg-[#ecefed] disabled:text-[#899794]"
                            />
                          </label>
                        </div>
                      </div>

                      {dayError && (
                        <p
                          role="alert"
                          className="mt-3 text-sm font-medium text-[#a34838]"
                        >
                          {dayError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </fieldset>

              {workingHoursUpdateError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {workingHoursUpdateError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeWorkingHoursEditor}
                  disabled={isUpdatingWorkingHours}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingWorkingHours}
                  aria-busy={isUpdatingWorkingHours}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingWorkingHours
                    ? "Čuvanje..."
                    : "Sačuvaj radno vreme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewTherapistOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeNewTherapistForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-therapist-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Terapeuti
                </p>
                <h2
                  id="new-therapist-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Novi terapeut
                </h2>
              </div>
              <button
                type="button"
                onClick={closeNewTherapistForm}
                disabled={isCreatingTherapist}
                aria-label="Zatvori formu za novog terapeuta"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              noValidate
              onSubmit={handleNewTherapistSubmit}
              className="mt-7"
            >
              <div>
                <label
                  htmlFor="new-therapist-name"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Ime i prezime <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="new-therapist-name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  required
                  value={newTherapistValues.name}
                  onChange={(event) => {
                    setNewTherapistValues((currentValues) => ({
                      ...currentValues,
                      name: event.target.value,
                    }));
                    setNewTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      name: undefined,
                    }));
                    setTherapistCreationError(undefined);
                  }}
                  disabled={isCreatingTherapist}
                  aria-invalid={Boolean(newTherapistErrors.name)}
                  aria-describedby={
                    newTherapistErrors.name
                      ? "new-therapist-name-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    newTherapistErrors.name
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {newTherapistErrors.name && (
                  <p
                    id="new-therapist-name-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {newTherapistErrors.name}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="new-therapist-speciality"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Specijalnost <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="new-therapist-speciality"
                  type="text"
                  autoComplete="off"
                  required
                  value={newTherapistValues.speciality}
                  onChange={(event) => {
                    setNewTherapistValues((currentValues) => ({
                      ...currentValues,
                      speciality: event.target.value,
                    }));
                    setNewTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      speciality: undefined,
                    }));
                    setTherapistCreationError(undefined);
                  }}
                  disabled={isCreatingTherapist}
                  aria-invalid={Boolean(newTherapistErrors.speciality)}
                  aria-describedby={
                    newTherapistErrors.speciality
                      ? "new-therapist-speciality-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    newTherapistErrors.speciality
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {newTherapistErrors.speciality && (
                  <p
                    id="new-therapist-speciality-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {newTherapistErrors.speciality}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="new-therapist-email"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Email za obaveštenja{" "}
                  <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="new-therapist-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={newTherapistValues.email}
                  onChange={(event) => {
                    setNewTherapistValues((currentValues) => ({
                      ...currentValues,
                      email: event.target.value,
                    }));
                    setNewTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      email: undefined,
                    }));
                    setTherapistCreationError(undefined);
                  }}
                  disabled={isCreatingTherapist}
                  aria-invalid={Boolean(newTherapistErrors.email)}
                  aria-describedby={
                    newTherapistErrors.email
                      ? "new-therapist-email-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    newTherapistErrors.email
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {newTherapistErrors.email && (
                  <p
                    id="new-therapist-email-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {newTherapistErrors.email}
                  </p>
                )}
              </div>

              {therapistCreationError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {therapistCreationError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeNewTherapistForm}
                  disabled={isCreatingTherapist}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTherapist}
                  aria-busy={isCreatingTherapist}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isCreatingTherapist ? "Dodavanje..." : "Dodaj terapeuta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTherapist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172b27]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditTherapistForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-therapist-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.28)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#397267] uppercase">
                  Terapeuti
                </p>
                <h2
                  id="edit-therapist-title"
                  className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#243c38] sm:text-3xl"
                >
                  Izmeni terapeuta
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditTherapistForm}
                disabled={isUpdatingTherapist}
                aria-label="Zatvori formu za izmenu terapeuta"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#397267]/15 bg-white text-xl leading-none text-[#397267] transition hover:border-[#397267]/30 hover:bg-[#edf5f0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#397267] disabled:cursor-wait disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              noValidate
              onSubmit={handleEditTherapistSubmit}
              className="mt-7"
            >
              <div>
                <label
                  htmlFor="edit-therapist-name"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Ime i prezime <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="edit-therapist-name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  required
                  value={editTherapistValues.name}
                  onChange={(event) => {
                    setEditTherapistValues((currentValues) => ({
                      ...currentValues,
                      name: event.target.value,
                    }));
                    setEditTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      name: undefined,
                    }));
                    setTherapistUpdateError(undefined);
                  }}
                  disabled={isUpdatingTherapist}
                  aria-invalid={Boolean(editTherapistErrors.name)}
                  aria-describedby={
                    editTherapistErrors.name
                      ? "edit-therapist-name-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    editTherapistErrors.name
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {editTherapistErrors.name && (
                  <p
                    id="edit-therapist-name-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {editTherapistErrors.name}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="edit-therapist-speciality"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Specijalnost <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="edit-therapist-speciality"
                  type="text"
                  autoComplete="off"
                  required
                  value={editTherapistValues.speciality}
                  onChange={(event) => {
                    setEditTherapistValues((currentValues) => ({
                      ...currentValues,
                      speciality: event.target.value,
                    }));
                    setEditTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      speciality: undefined,
                    }));
                    setTherapistUpdateError(undefined);
                  }}
                  disabled={isUpdatingTherapist}
                  aria-invalid={Boolean(editTherapistErrors.speciality)}
                  aria-describedby={
                    editTherapistErrors.speciality
                      ? "edit-therapist-speciality-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    editTherapistErrors.speciality
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {editTherapistErrors.speciality && (
                  <p
                    id="edit-therapist-speciality-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {editTherapistErrors.speciality}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <label
                  htmlFor="edit-therapist-email"
                  className="block text-sm font-semibold text-[#243c38]"
                >
                  Email za obaveštenja{" "}
                  <span className="text-[#b45745]">*</span>
                </label>
                <input
                  id="edit-therapist-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={editTherapistValues.email}
                  onChange={(event) => {
                    setEditTherapistValues((currentValues) => ({
                      ...currentValues,
                      email: event.target.value,
                    }));
                    setEditTherapistErrors((currentErrors) => ({
                      ...currentErrors,
                      email: undefined,
                    }));
                    setTherapistUpdateError(undefined);
                  }}
                  disabled={isUpdatingTherapist}
                  aria-invalid={Boolean(editTherapistErrors.email)}
                  aria-describedby={
                    editTherapistErrors.email
                      ? "edit-therapist-email-error"
                      : undefined
                  }
                  className={`mt-2 min-h-12 w-full rounded-2xl border bg-[#fffdf9] px-4 py-3 text-base text-[#243c38] outline-none transition focus:ring-3 disabled:cursor-wait disabled:opacity-60 ${
                    editTherapistErrors.email
                      ? "border-[#b45745] focus:border-[#b45745] focus:ring-[#b45745]/15"
                      : "border-[#397267]/18 focus:border-[#397267]/45 focus:ring-[#397267]/12"
                  }`}
                />
                {editTherapistErrors.email && (
                  <p
                    id="edit-therapist-email-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#a34838]"
                  >
                    {editTherapistErrors.email}
                  </p>
                )}
              </div>

              {therapistUpdateError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
                >
                  {therapistUpdateError}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditTherapistForm}
                  disabled={isUpdatingTherapist}
                  className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTherapist}
                  aria-busy={isUpdatingTherapist}
                  className="min-h-11 rounded-full bg-[#397267] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(57,114,103,0.22)] transition hover:bg-[#2f6158] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingTherapist ? "Čuvanje..." : "Sačuvaj izmene"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {therapistToDeactivate && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-[#172b27]/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeactivationConfirmation();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deactivate-therapist-title"
            aria-describedby="deactivate-therapist-description"
            className="w-full max-w-lg rounded-3xl border border-white/80 bg-[#fffaf3] p-6 shadow-[0_28px_90px_rgba(23,43,39,0.32)] sm:p-8"
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f7dfd7] text-2xl text-[#a34838]">
              <span aria-hidden="true">!</span>
            </div>
            <h2
              id="deactivate-therapist-title"
              className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#243c38]"
            >
              Da li želite da deaktivirate terapeuta?
            </h2>
            <p
              id="deactivate-therapist-description"
              className="mt-3 text-sm leading-6 text-[#6b807c]"
            >
              {therapistToDeactivate.name} će ostati sačuvan u sistemu i
              istoriji. Kada javno filtriranje bude uvedeno, neće se koristiti
              za nova zakazivanja dok ga ponovo ne aktivirate.
            </p>

            {therapistStatusError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[#b45745]/20 bg-[#fff8f5] px-4 py-3 text-sm font-medium leading-6 text-[#8f4033]"
              >
                {therapistStatusError}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeactivationConfirmation}
                disabled={updatingStatusTherapistId !== null}
                className="min-h-11 rounded-full border border-[#397267]/20 bg-white px-6 py-2 text-sm font-semibold text-[#397267] transition hover:border-[#397267]/35 disabled:cursor-wait disabled:opacity-50"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={() =>
                  void setTherapistActive(therapistToDeactivate, false)
                }
                disabled={updatingStatusTherapistId !== null}
                aria-busy={updatingStatusTherapistId !== null}
                className="min-h-11 rounded-full bg-[#b45745] px-6 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(180,87,69,0.22)] transition hover:bg-[#984737] disabled:cursor-wait disabled:opacity-60"
              >
                {updatingStatusTherapistId !== null
                  ? "Deaktiviranje..."
                  : "Potvrdi deaktivaciju"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
