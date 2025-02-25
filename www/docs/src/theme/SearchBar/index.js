/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import { useHistory } from "@docusaurus/router"
import { useBaseUrlUtils } from "@docusaurus/useBaseUrl"
import Link from "@docusaurus/Link"
import Head from "@docusaurus/Head"
import useSearchQuery from "@theme/hooks/useSearchQuery"
import { DocSearchButton, useDocSearchKeyboardEvents } from "@docsearch/react"
import useAlgoliaContextualFacetFilters from "@theme/hooks/useAlgoliaContextualFacetFilters"
import { translate } from "@docusaurus/Translate"
import styles from "./styles.module.css"

let DocSearchModal = null

const convertToKebabCase = (string) => {
  return string
    .replace(/\s+/g, "-")
    .replace("'", "")
    .replace(".", "")
    .replace('"', "")
    .toLowerCase()
}

const replaceUrl = (item) => {
  let { url, hierarchy } = item
  if (url.includes("api/store") || url.includes("/api/admin")) {
    url = url.replace("#", "")
    if (hierarchy.lvl2) {
      const index = url.lastIndexOf("/")
      url =
        url.substring(0, index) +
        `/${convertToKebabCase(hierarchy.lvl1)}` +
        url.substring(index)
    }
  }
  return url
}

function Hit({ hit, children }) {
  if (hit.url.includes("/api/store") || hit.url.includes("/api/admin")) {
    let url = replaceUrl(hit)
    return <a href={url}>{children}</a>
  }

  return <Link to={hit.url}>{children}</Link>
}

function ResultsFooter({ state, onClose }) {
  const { generateSearchPageLink } = useSearchQuery()

  return (
    <Link to={generateSearchPageLink(state.query)} onClick={onClose}>
      See all {state.context.nbHits} results
    </Link>
  )
}

function DocSearch({ contextualSearch, ...props }) {
  const { siteMetadata } = useDocusaurusContext()

  const contextualSearchFacetFilters = useAlgoliaContextualFacetFilters()

  const configFacetFilters = props.searchParameters?.facetFilters ?? []

  const facetFilters = contextualSearch
    ? // Merge contextual search filters with config filters
      [...contextualSearchFacetFilters, ...configFacetFilters]
    : // ... or use config facetFilters
      configFacetFilters

  // we let user override default searchParameters if he wants to
  const searchParameters = {
    ...props.searchParameters,
    facetFilters,
  }

  const { withBaseUrl } = useBaseUrlUtils()
  const history = useHistory()
  const searchContainer = useRef(null)
  const searchButtonRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [initialQuery, setInitialQuery] = useState(null)

  const importDocSearchModalIfNeeded = useCallback(() => {
    if (DocSearchModal) {
      return Promise.resolve()
    }

    return Promise.all([
      import("@docsearch/react/modal"),
      import("@docsearch/react/style"),
      import("./styles.css"),
    ]).then(([{ DocSearchModal: Modal }]) => {
      DocSearchModal = Modal
    })
  }, [])

  const onOpen = useCallback(() => {
    importDocSearchModalIfNeeded().then(() => {
      searchContainer.current = document.createElement("div")
      document.body.insertBefore(
        searchContainer.current,
        document.body.firstChild
      )
      setIsOpen(true)
    })
  }, [importDocSearchModalIfNeeded, setIsOpen])

  const onClose = useCallback(() => {
    setIsOpen(false)
    searchContainer.current.remove()
  }, [setIsOpen])

  const onInput = useCallback(
    (event) => {
      importDocSearchModalIfNeeded().then(() => {
        setIsOpen(true)
        setInitialQuery(event.key)
      })
    },
    [importDocSearchModalIfNeeded, setIsOpen, setInitialQuery]
  )

  const navigator = useRef({
    navigate({ item }) {
      let url = replaceUrl(item)
      //Need to type out the entire URL to prevent it from attempting to open the page
      //as part of the docusaurus project. Which will fail.
      window.location = `https://docs.medusa-commerce.com${url}`
    },
    navigateNewTab({ item }) {
      let url = replaceUrl(item)
      const windowReference = window.open(url, "_blank", "noopener")

      if (windowReference) {
        windowReference.focus()
      }
    },
    navigateNewWindow({ item }) {
      const url = replaceUrl(item)

      window.open(url, "_blank", "noopener")
    },
  }).current

  const transformItems = useRef((items) => {
    return items.map((item) => {
      // We transform the absolute URL into a relative URL.
      // Alternatively, we can use `new URL(item.url)` but it's not
      // supported in IE.
      const a = document.createElement("a")
      a.href = item.url

      return {
        ...item,
        url: withBaseUrl(`${a.pathname}${a.hash}`),
      }
    })
  }).current

  const resultsFooterComponent = useMemo(
    () => (footerProps) => <ResultsFooter {...footerProps} onClose={onClose} />,
    [onClose]
  )

  const transformSearchClient = useCallback(
    (searchClient) => {
      searchClient.addAlgoliaAgent("docusaurus", siteMetadata.docusaurusVersion)

      return searchClient
    },
    [siteMetadata.docusaurusVersion]
  )

  useDocSearchKeyboardEvents({
    isOpen,
    onOpen,
    onClose,
    onInput,
    searchButtonRef,
  })

  const translatedSearchLabel = translate({
    id: "theme.SearchBar.label",
    message: "Search",
    description: "The ARIA label and placeholder for search button",
  })

  return (
    <>
      <Head>
        {/* This hints the browser that the website will load data from Algolia,
        and allows it to preconnect to the DocSearch cluster. It makes the first
        query faster, especially on mobile. */}
        <link
          rel="preconnect"
          href={`https://${props.appId}-dsn.algolia.net`}
          crossOrigin="anonymous"
        />
      </Head>

      <div className={styles.searchBox}>
        <DocSearchButton
          onTouchStart={importDocSearchModalIfNeeded}
          onFocus={importDocSearchModalIfNeeded}
          onMouseOver={importDocSearchModalIfNeeded}
          onClick={onOpen}
          ref={searchButtonRef}
          translations={{
            buttonText: translatedSearchLabel,
            buttonAriaLabel: translatedSearchLabel,
          }}
        />
      </div>

      {isOpen &&
        createPortal(
          <DocSearchModal
            onClose={onClose}
            initialScrollY={window.scrollY}
            initialQuery={initialQuery}
            navigator={navigator}
            transformItems={transformItems}
            hitComponent={Hit}
            resultsFooterComponent={resultsFooterComponent}
            transformSearchClient={transformSearchClient}
            {...props}
            searchParameters={searchParameters}
          />,
          searchContainer.current
        )}
    </>
  )
}

function SearchBar() {
  const { siteConfig } = useDocusaurusContext()
  return <DocSearch {...siteConfig.themeConfig.algolia} />
}

export default SearchBar
