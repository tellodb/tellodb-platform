import { Slot, component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

import { Header } from "~/components/Header";
import { getCurrentUser } from "~/lib/auth";

export const useAuthUser = routeLoader$((event) => {
  return getCurrentUser(event.cookie);
});

export default component$(() => {
  const authUser = useAuthUser();

  return (
    <>
      <Header user={authUser.value} />
      <div class="pt-[104px]">
        <Slot />
      </div>
    </>
  );
});
