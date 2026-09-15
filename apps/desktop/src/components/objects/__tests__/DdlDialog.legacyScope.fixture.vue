<template>
  <Dialog :open="true">
    <DialogContent class="gauss-horizon-ddl-view-dialog sm:max-w-190">
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
html.gauss-horizon-legacy-webview [data-slot="dialog-content"].gauss-horizon-ddl-view-dialog[class~="max-w-sm"] {
  max-width: 47.5rem !important;
}

html.gauss-horizon-legacy-webview [data-slot="dialog-content"].gauss-horizon-ddl-view-dialog [data-slot="dialog-footer"] {
  flex-direction: row !important;
}
</style>
