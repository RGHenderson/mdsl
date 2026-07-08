# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/RGHenderson/mdsl/compare/v0.1.4...v0.2.0) (2026-07-08)


### Added

* add blockquote() node and fix rule() serialization ([a2384cb](https://github.com/RGHenderson/mdsl/commit/a2384cbfdbbcc143f2fdefa74af24e3fdf2a8b16))
* add nameField option to section() for capturing heading text ([52d6085](https://github.com/RGHenderson/mdsl/commit/52d608551bfead9da650abf80078f3c748306b25))
* **core:** add codeBlocks() builder for capturing multiple code blocks ([84a3e66](https://github.com/RGHenderson/mdsl/commit/84a3e66693be0c596b0d142b16f15336b245057b))
* **core:** add image() node for capturing markdown images ([3f14cc9](https://github.com/RGHenderson/mdsl/commit/3f14cc92ce570ddf1596c913e9e4bff0a46fc61d))
* **core:** add minItems option to repeat() for zero-or-more semantics ([7b720c9](https://github.com/RGHenderson/mdsl/commit/7b720c96938411eff5b5bd59d2f1a20e7acee70d))
* **core:** add ordered list support with orderedList() builder ([6e3d3eb](https://github.com/RGHenderson/mdsl/commit/6e3d3eb4c0f3c77f5a18b60d1e73c9bb6bb61446))
* **core:** add title() shorthand for the document H1 heading ([37b974f](https://github.com/RGHenderson/mdsl/commit/37b974f2245bc032f6d76805136f2ac4a6a794f0))


### Fixed

* **core:** infer field types correctly from repeat() builder ([665508f](https://github.com/RGHenderson/mdsl/commit/665508f8a0149e34e4b004dfdb65fb66c15a4610))
* **core:** throw a descriptive error when serializing regex section/repeat without nameField ([01aba4c](https://github.com/RGHenderson/mdsl/commit/01aba4c46d22b61894f0709afd19ff29ad12ff77))
* **core:** use bare > for blank lines in blockquote serialization ([9791b6d](https://github.com/RGHenderson/mdsl/commit/9791b6d69bb90b1129c6df2d5bf863203d2a975d))
* return pre-transform values from extractList/extractTable ([7262e20](https://github.com/RGHenderson/mdsl/commit/7262e2068989e3da0db2baad8f4b17eb6a6e4308))
* stop content nodes bleeding into nested sub-sections ([c39bb19](https://github.com/RGHenderson/mdsl/commit/c39bb193033663e9ab5a0d0fb6a2337b14636a9f))


### Changed

* **core:** clean up public API surface before 1.0.0 ([8c43db3](https://github.com/RGHenderson/mdsl/commit/8c43db3f87f19dded6b4336c0feda54be5ce1954))
* **core:** drop infer type alias and consolidate InferDocument ([90096a7](https://github.com/RGHenderson/mdsl/commit/90096a75f2d605f4930f8e7fa370b2b68dd8d474))


### Documentation

* **core:** document new builders and add tutorial example ([1585c77](https://github.com/RGHenderson/mdsl/commit/1585c778e3fdcf7f39854334e2b6d551543a6b6e))

## [0.1.4](https://github.com/RGHenderson/mdsl/compare/v0.1.3...v0.1.4) (2026-06-26)


### Added

* add .or() fluent alternation on MdslNode ([ae17f75](https://github.com/RGHenderson/mdsl/commit/ae17f75b07ded876cfa37284ef76cf04ecebdf84))
* add .refine() post-parse validation API ([bb69c67](https://github.com/RGHenderson/mdsl/commit/bb69c678ef8be129197843bcc08b00ee7a3a4924))
* add rule() for named reusable nodes ([8a86c02](https://github.com/RGHenderson/mdsl/commit/8a86c02279b4198d71f9f043c2f5cae3c7704887))


### Fixed

* add non-null assertions in recipe example ([9427b3b](https://github.com/RGHenderson/mdsl/commit/9427b3bdb98d069ff4881bb029ca70164a734761))

## [0.1.3](https://github.com/RGHenderson/mdsl/compare/v0.1.2...v0.1.3) (2026-06-26)


### CI

* only node 22 for CI ([8191bd1](https://github.com/RGHenderson/mdsl/commit/8191bd176f624b0ae2d5516b86ec92f17f8556a6))

## [0.1.2](https://github.com/RGHenderson/mdsl/compare/v0.1.1...v0.1.2) (2026-06-26)


### Added

* add cli, more docs, remark plugin ([79c90b9](https://github.com/RGHenderson/mdsl/commit/79c90b996af9d9ed0ceaa4892afe7a73026a3469))

## [0.1.1](https://github.com/RGHenderson/mdsl/compare/v0.1.0...v0.1.1) (2026-06-26)


### Fixed

* **release:** scope package name to @rghenderson/mdsl ([c4b64b9](https://github.com/RGHenderson/mdsl/commit/c4b64b961b39a8e5c11e3930ab3711f4bc458f00))

## 0.1.0 (2026-06-26)


### Added

* **core:** initial implementation of mdsl v0.1.0 ([4a8122b](https://github.com/RGHenderson/mdsl/commit/4a8122b92c16565f03fa50cac4de011d632be43d))
