# Notion Source Map

Parent specification:

- https://app.notion.com/p/3a968f0bf27380fda24ae5ddd012fcc8

Child specifications reviewed for Version 1 freeze:

- Provider Loader Node: https://app.notion.com/p/3a968f0bf273805e821bf65df7958ca0
- Provider Loader final JSON: https://app.notion.com/p/3a968f0bf2738058a5e5e5eb0db11afc
- Provider Selector overview: https://app.notion.com/p/3aa68f0bf27380efaa5cd187cd465ba4
- Provider Selector final freeze: https://app.notion.com/p/3aa68f0bf2738061b27ee1ade1ae5c7a
- Provider Selector top-five updates: https://app.notion.com/p/3aa68f0bf273803d99c3f69fad6cfb2b
- Invoice Template final freeze: https://app.notion.com/p/3aa68f0bf27380f18f0cea7f73f563aa
- Email List final freeze: https://app.notion.com/p/3aa68f0bf27380599143f25218917077
- Request Builder overview: https://app.notion.com/p/3aa68f0bf273802c8d5fde9a85d23418
- Request Builder final freeze: https://app.notion.com/p/3aa68f0bf27380f79819dee7f05d4bc7
- Invoice Sender overview: https://app.notion.com/p/3aa68f0bf273801195fdd6f45c47ac58
- Invoice Sender final freeze: https://app.notion.com/p/3aa68f0bf2738055bb5df81563e9a899
- Status Checker overview: https://app.notion.com/p/3aa68f0bf273803b983ffae41c3456d1
- Status Checker final freeze: https://app.notion.com/p/3aa68f0bf2738055b9eafe2d531bde87
- Status Manager overview: https://app.notion.com/p/3aa68f0bf27380098e9eff7a8f3c15f0
- Status Manager final freeze: https://app.notion.com/p/3aa68f0bf273805e993cd5a0d6786d15

## Conflict rule

The current parent-page flow and this repository freeze resolve implementation conflicts. Older child-page text that says Provider Loader directly connects to Google Sheets is interpreted for Version 1 as: the built-in Google Sheets node reads rows, then Provider Loader validates and normalizes those rows.
