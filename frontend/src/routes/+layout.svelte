<script lang="ts">
  import '../app.scss';
  import '../wasm_exec.js';
  import { assets } from '$app/paths';
  import { browser } from '$app/environment';
  import { loadSkillTree } from '../lib/skill_tree';
  import { syncWrap } from '../lib/worker';
  import { initializeCrystalline } from '../lib/types';

  let wasmLoading = true;

  // eslint-disable-next-line no-undef
  const go = new Go();

  if (browser) {
    fetch(assets + '/calculator.wasm')
      .then((data) => data.arrayBuffer())
      .then((data) => {
        WebAssembly.instantiate(data, go.importObject).then((result) => {
          go.run(result.instance);
          wasmLoading = false;
          initializeCrystalline();
          loadSkillTree();
        });

        syncWrap.boot(data);
      });
  }
</script>

{#if wasmLoading}
  <div class="boot-screen">
    <div class="boot-inner">
      <h1 class="boot-title">軍團珠寶高手工具</h1>
      <div class="boot-by">by ET</div>
      <div class="boot-bar"><span /></div>
    </div>
  </div>
{:else}
  <slot />
{/if}
