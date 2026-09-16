<template>
  <Dialog :open="true">
    <DialogContent class="chiron-horizon-ddl-view-dialog sm:max-w-190">
      <div>fixture body</div>
      <DialogFooter>
        <Button>fixture action</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
</script>

<style scoped>
html.chiron-horizon-legacy-webview [data-slot="dialog-content"].chiron-horizon-ddl-view-dialog[class~="max-w-sm"] {
  max-width: 47.5rem !important;
}

html.chiron-horizon-legacy-webview [data-slot="dialog-content"].chiron-horizon-ddl-view-dialog [data-slot="dialog-footer"] {
  flex-direction: row !important;
}
</style>
