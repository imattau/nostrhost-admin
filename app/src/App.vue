<script setup lang="ts">
const baseUrl = import.meta.env.BASE_URL
</script>

<template>
  <div
    id="app"
    class="tw:flex tw:min-h-screen tw:flex-col tw:bg-background tw:font-sans tw:text-foreground"
  >
    <header class="tw:border-b tw:border-border-subtle tw:bg-surface">
      <div
        class="tw:mx-auto tw:flex tw:w-full tw:max-w-6xl tw:items-center tw:gap-3 tw:px-4 tw:py-3"
      >
        <RouterLink
          :to="{ name: 'app-management' }"
          class="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:text-foreground tw:no-underline tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500"
        >
          <span
            class="tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-[10px] tw:bg-brand-500 tw:shadow-[0_4px_12px_rgba(139,92,246,0.35)]"
          >
            <img
              :src="`${baseUrl}nostrhost-mark.svg`"
              alt=""
              width="18"
              height="18"
            />
          </span>
          <span class="tw:flex tw:flex-col tw:leading-tight">
            <span class="tw:text-base tw:font-bold">NostrHost</span>
            <span
              class="tw:font-mono tw:text-[10px] tw:uppercase tw:tracking-wider tw:text-brand-500"
              >System Console</span
            >
          </span>
        </RouterLink>
        <nav class="tw:ml-auto tw:flex tw:items-center tw:gap-4 tw:text-sm">
          <RouterLink
            class="tw:text-foreground tw:no-underline tw:hover:text-brand-500"
            :to="{ name: 'app-management' }"
            >Applications</RouterLink
          >
          <RouterLink
            class="tw:text-muted-foreground tw:no-underline tw:hover:text-brand-500"
            :to="{ name: 'native-packages' }"
            >Package authoring</RouterLink
          >
        </nav>
      </div>
    </header>

    <main class="tw:mx-auto tw:w-full tw:max-w-6xl tw:flex-1 tw:px-4 tw:py-6">
      <RouterView />
    </main>

    <footer
      class="tw:mt-auto tw:border-t tw:border-border-subtle tw:py-4 tw:text-sm tw:text-muted-foreground"
    >
      <p
        class="tw:mx-auto tw:mb-0 tw:max-w-6xl tw:px-4 tw:font-mono tw:text-xs"
      >
        NostrHost Control Plane
      </p>
    </footer>
  </div>
</template>
