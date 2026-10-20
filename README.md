# Module 05 · Distributed and NoSQL Databases

An interactive, scroll-driven website that covers all of **BACSE202 Database Systems, Module 5**. Each idea is a scene you scroll through, and most scenes have something to click, drag or break on purpose.

> Deploying it? See **[DEPLOY.md](DEPLOY.md)** (Vercel for the site, Render for the quiz API, MongoDB Atlas for scores).

Built by Team 9: Garapati Sai Aditya (25BCE2449), Shrish Verma (25BCE2542), Sreya Chandrasekharan (25BCE2606), Annette Jose (25BCE2635), Sahila Yazar Pottayil (25BCE2642).

## How to use it

- Scroll **slowly** with a mouse wheel or trackpad. Many scenes are pinned and play as you scroll.
- **Contents** (top right) opens a list of every chapter. Click one to jump straight there.
- The dashes on the right edge are the nine parts (00 to 08). Hover to see their names, click to jump.
- Best in Chrome with hardware acceleration on (Settings → System). On a projector, use full screen (F11).

## What is on the page

The order follows the syllabus: distributed databases first, then NoSQL.

| Part | Chapter | What it teaches | Try this |
|---|---|---|---|
| 0 | Module map | All 20 topics as cards | Hover or tap a card, then press **Go** |
| 1 Distributed | Distributed DB | Definition, transparency, reliability vs availability | Run the three queries, turn transparency off, take Mumbai offline, then replicate it |
| | Types of DDBMS | Homogeneous, heterogeneous, federated, multidatabase | Click A–D and watch the three bars |
| | Architectures | Shared memory, shared disk, shared nothing; GCS, LCS, LIS; three-tier | Switch the architecture; click the schema layers |
| | Fragmentation | Horizontal (σ), vertical (π + key), mixed; completeness, reconstruction, disjointness | Split the EMPLOYEE table, then "introduce a mistake" |
| | Replication and allocation | No, partial and full replication | Open a site folder, press **+**, take a site offline |
| | Two-phase commit | Prepare, vote, commit or abort, blocking, 3PC | Scroll through it three times: all YES, one NO, coordinator crash |
| | Concurrency and recovery | Primary site, backup site, primary copy, voting; distributed deadlock | Lock X, fail site 1, lock again, in each technique |
| | Query processing | Mapping, localization, global and local optimization | Scroll through the four stages |
| | Transfer cost lab | The textbook example: 1,000,000-byte EMPLOYEE vs 3,500-byte DEPARTMENT, plus semijoin | Pick Q or Q′, a result site, then a strategy |
| 2 Why NoSQL | The wall | 3 Vs, dense vs sparse data, who built the first systems, the perfect storm | Store the users table "sparse" |
| | Every tap | One app, many kinds of database | Tap the phone buttons |
| | Definition, Origins | "Not only SQL", nosql-database.org definition, 1970–2018 timeline | Just scroll |
| | RDBMS recap, Scale lab, Impedance mismatch | Tables and ACID; scale up vs scale out; rows vs documents | Drag the traffic slider; fetch the order |
| 3 Characteristics | Characteristics | The eight NoSQL traits from the textbook | Hash vs range partitioning lab |
| | Schema-less | Schema on write vs schema on read | Add phone, tags, loyalty_tier |
| 4 CAP · ACID · BASE | ACID | Atomicity, consistency, isolation, durability with a bank | Crash a transfer, reuse a cheque number, read during a withdrawal, crash the server |
| | CAP theorem | Pick two; CA, CP, AP examples | Choose an edge, cut the link, book a seat on both sides |
| | Tunable consistency | Quorums, R + W > N | Change W and R, write, read quickly |
| | ACID vs BASE | Basically available, soft state, eventually consistent | Watch the five replicas converge |
| 5 Data modelling | Aggregates | Aggregate-oriented vs aggregate-ignorant (Fowler's customer/order example) | Switch between the three designs and read the cost table |
| | Modelling techniques | Embed vs reference (the textbook's PROJECT/WORKER documents) | Read P1, then make John join P2 |
| 6 Distribution · MapReduce | Distribution models | Single server, sharding, master-slave, peer-to-peer, combined | Write, read, fail a node, "two writes at once" |
| | The cluster (3D) | Sharding, replication factor 3, failover | Drag to rotate; write keys; kill a primary |
| | MapReduce | Split, map, shuffle and sort, reduce, re-run failed tasks | Scroll through it |
| | Word count lab | A real MapReduce job in the browser | Edit the text, turn the combiner on, run |
| 7 Types of NoSQL | Four families | Key-value, document, column family, graph, each with a working demo | Use each demo |
| | Notable systems | Redis, Dynamo, MongoDB, CouchDB, Bigtable, HBase, Cassandra, Neo4j… | Open a folder, pick a file |
| | SQL vs NoSQL, Advantages, Limitations | Comparison, six gains, six costs | Show where the line blurs; flip the cards |
| | In the wild, Choose, Polyglot | When to use and when not; real deployments; picking a model | Try the bank / IoT / social presets |
| 8 Conclusion | Conclusion | Right tool for the job; don't forget the DBA | |
| | Recap and quiz | Seven takeaways and a 12-question quiz with a live leaderboard | Everyone plays on their phone |

## The quiz

Players type a name and answer 12 questions. The server scores the answers itself, so nobody can post a fake score, and ties go to the faster player. Without a server URL the board is saved in the browser instead.

If you change a question or its correct answer, update **both**:
- `Q` in `src/scripts/widgets.ts`
- `ANSWER_KEY` in `server/src/index.js`

## Run it locally

```bash
npm install
npm run dev                                   # http://localhost:4321

# optional: the quiz API (keeps scores in memory unless MONGODB_URI is set)
cd server && npm install && npm run dev       # http://localhost:8080
# then start the site with: PUBLIC_API_URL=http://localhost:8080 npm run dev
```

## How it is built

- **Astro** for the page, split into one file per part in `src/parts/`.
- **three.js** for the particle world behind every chapter (`src/scripts/world.ts`) and the 3D cluster (`machine.ts`).
- **GSAP** (ScrollTrigger, SplitText, Flip) and **Lenis** for scroll-driven motion.
- Components adapted from the design prompts, rewritten without React:
  - scroll-morph cards → the module map (`morph.ts`)
  - frame-sequence hero → 2PC, query processing and MapReduce stages (`frames.ts`, drawn live on a canvas)
  - glass folder cards → database sites and the archive (`folders.ts`, `art.ts`)
  - horizontal timeline, container scroll, phone scroll and 3D factory → origins, impedance mismatch, every tap and the cluster

## Sources

Elmasri and Navathe, *Fundamentals of Database Systems* (the course textbook) and the Module 5 course slides; Sadalage and Fowler, *NoSQL Distilled*; Dean and Ghemawat, *MapReduce* (2004); Brewer's 2000 PODC keynote; Gilbert and Lynch (2002); Pritchett, *BASE: An Acid Alternative* (2008); the Bigtable, Dynamo and GFS papers. Every source is linked at the bottom of the page.
