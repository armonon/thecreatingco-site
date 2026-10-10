Website Checkup runs inside /checkup/ using the bounded hosted handler from armonon/weblab PR2. The visual WebLab builder remains a separate app.
Bundle with esbuild 0.25.11, format esm, platform node, target node22, external playwright-core. The browser import is lazy and is never used by the hosted handler.
Local source: /Users/lillypad/Projects/weblab-integration-20261010. Release evidence: /Users/lillypad/Projects/company-checkup-20261010.
The production deployment guard must remain: this GitHub mirror is not a complete site deployment input.
Published as a retained-file/function overlay, adding only the weblab-audit function and three checker page files.
