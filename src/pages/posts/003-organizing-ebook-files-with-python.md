---
layout: "../../layouts/BlogPost.astro"
title: "Organizing EBook Files with Python"
description: "Actually doing a side project to save myself time"
publishDate: "13 Oct 2022"
pubDate: "13 Oct 2022"
heroImage:
  src: "/assets/blog/003-organizing-ebook-files-with-python/library.png"
  alt: "A Library full of books"
  width: 800
---

If you want to jump to the code snippets, click [here](#gathering-all-unorganized-files)

Full python file available [here on GitHub](https://github.com/BrianVia/booksort/blob/main/book-sort.py)

## The Problem

Over the years, I’ve accumulated many hundreds of ebooks. Some from buying digital copies from places like Gumroad, others free online like [Software Engineering at Google](https://abseil.io/resources/swe-book/html/toc.html).

However as I became more and more busy, keeping a clean file structure to allow me to find what I’m looking for became harder and harder. The result was a hodgepodge of files without naming conventions, directories upon directories labeled “unorganized” as I tried to manually sift through hundreds of files, manually renaming them to the format I wanted, and placed inside of a single directory per book. It just became too much.

This was basically me when looking for anything:

[<img src="/assets/blog/003-organizing-ebook-files-with-python/charlie.png" alt="Charlie's Murder Board from Always Sunny in Philadelphia" />](/assets/blog/003-organizing-ebook-files-with-python/charlie.png)

## What I Wanted the End to Look Like

```bash
Books Directory/
  title-author/
    title-author.epub
  title2-author2/
    title2-author.pdf
```

In wanting to [self host a calibre instance](https://hub.docker.com/r/linuxserver/calibre) with all of my files, ingesting them via 1 directory per book seemed like the best system. It was also incredibly necessary for just reading the files locally from my desktops via my NAS.

## Why Python? 🐍

First and foremost, I decided to go with Python the language of choice for this project for a couple reasons.

While it does involve renaming files, which could be easily done with bash, the logic was going to be a little complicated in terms of passing data between functions to-and-fro, which means bash would get a little tough to read IMO.

Python also has a rich ecosystem of ebook parsing libraries, and fairly easily handles things like file renaming, extensions, environment variables on Linux machines, which is what my NAS box runs. And while my first language is typescript/javascript, so I could’ve utilized something like BASH + [Google’s ZX](https://github.com/google/zx), it felt like a good case to try to get some experience with Python, which I’ve never really used. Luckily VS Code’s intellisense (with some Python plugins), and Python’s relatively simple syntax made it quite easy to get from A→ B in terms of getting the pieces all put together.

# The Individual Pieces of The Book Sorting Program

This was how I broke down the individual parts of this sorting library

1. Gather all files from my unorganized directory, ideally recursively
2. Parse metadata from any ebooks in my library.
   1. EPUB files
   2. PDF files
3. Organize books into their new location (`<author-title>/<author-title>.<ext>`
4. (Optional) Reading library paths for input, outputs and any issue files

## Gathering All Unorganized Files

Grabbing all my files and putting them into one flat directory wasn’t too bad. I called this my `BOOKSORT_INPUT_PATH` variable. Currently it’s grabbed from the command line environment, but it could be refactored to take as CLI args, or just hard-coded defaults.

```python
# Returns all files in a directory
def getAllFiles(path: string):
    files = []
    for r, d, f in os.walk(path): #r - root, d - dir, f - file
        for file in f:
            if file.endswith(".pdf") or file.endswith(".epub"):
                files.append(os.path.join(r, file))
    print(files)
    return files
```

This chunk is relatively straightforward hopefully. Given a directory, walk the directory and for each file path found that ends with `.pdf` or `.epub` add it to an array, and then return the array. This will give us a list of files to lookup the metadata for, and then eventually sort.

The array will look like this:

```bash
['/full/path/to/book/book.epub','/full/path/to/book2/book2.pdf',...]
```

This array gets returned from the function, so we can iterate over the list of book files to sort.

### Parsing Metadata

Parsing the metadata was relatively straightforward: Find epub and pdf parsing libraries, implement and grab the correct fields.

**For epub files we’re using** [epub_meta](https://github.com/paulocheque/epub-meta). Make sure you install with `pip install epub_meta` or `pip3 install epub_meta`

**For pdf files we’re using** [pdfx](https://github.com/metachris/pdfx). This also needs an install with `pip install pdfx` or `pip3 install pdfx`

For all the files in our array, we’re going to pass them to their respective parsing functions like so:

```python
for file in files:
        TitleAndAuthorString = ""
        if file.endswith(".epub"):
            TitleAndAuthorString = getEpubTitleAndAuthorPath(file)
        if file.endswith(".pdf"):
            TitleAndAuthorString = getPdfTitleAndAuthorPath(file)
```

#### EPUB Files

```python
# Returns the title and author of an epub file in the format "Title - Author"
def getEpubTitleAndAuthorPath(filepath: string):
    try:
        print("INFO: Getting metadata for: " + filepath)
        data = epub_meta.get_epub_metadata(filepath)
        title = data['title'] or "Unknown"
        authors =", ".join(data['authors']) or "Unknown"
        print("INFO: Got metadata for " + filepath + ": " + title + " - " + authors)
        return(title + " - " + authors)
    except epub_meta.EPubException as e:
        print(e)
        return None
```

EPUB_META allows us to grab the metadata with this line

`data = epub_meta.get_epub_metadata(filepath)`

and then specific fields like this:

- `title = data['title'] or "Unknown"`
- `authors =", ".join(data['authors']) or "Unknown"` (In this case, we’re doing a `join` with a comma in case there is more than 1 author.

Both of these will fallback to `Unknown` if we can’t parse the metadata for some reason.

#### PDF Files

```python
def getPdfTitleAndAuthorPath(filepath: string):
    issuesPath = os.environ["BOOKSORT_ISSUES_PATH"]
    file = filepath
    try:
        print("INFO: Getting metadata for: " + filepath)
        pdf = pdfx.PDFx(filepath)
        metadata = pdf.get_metadata()
        title = metadata.get("Title") or "Unknown"
        authors = metadata.get("Author") or "Unknown"
        print("INFO: Got metadata for " + filepath + ": " + title + " - " + authors)
        return(title + " - " + authors)
    except pdfx.exceptions.PDFInvalidError as e:
        print(e)
        print("ERROR: Moving " + getFileName(file) + " to issues folder")
        os.rename(file, issuesPath + "/" + getFileName(file))
        return None
    except pdfx.exceptions.PDFExtractionError as e:
        print(e)
        print("ERROR: Moving " + getFileName(file) + " to issues folder")
        os.rename(file, issuesPath + "/" + getFileName(file))
        return None
    except pdfx.exceptions.FileNotFoundError as e:
        print(e)
        print("ERROR: Moving " + getFileName(file) + " to issues folder")
        os.rename(file, issuesPath + "/" + getFileName(file))
        return None
```

PDFX allows us to read metadata in a similar fashion.

After creating the pdf and parsing metadata with these two lines

```python
pdf = pdfx.PDFx(filepath)
metadata = pdf.get_metadata()
```

We can read from the metadata with the `.get(<fieldName>)` method

```python
title = metadata.get("Title") or "Unknown"
authors = metadata.get("Author") or "Unknown"
# The Authors field is already comma delmited by PDFX, so no need to join here.
...
return(title + " - " + authors)
```

We’ll also create a function to return the file extension for proper renaming later.

```python
# Returns the file extension of a file
def getFileExtension(file):
    return os.path.splitext(file)[1]
```

### Organizing the Files to their Final Locations

Lastly, we do some `os.makedirs` and `os.rename` magic to move things around and create the needed directories if it doesn’t already exist.

```python
extension = getFileExtension(file) # grab this so we can rename easily.

if TitleAndAuthorString and "Unknown" not in TitleAndAuthorString:
    if not os.path.exists(outputPath + "/" + TitleAndAuthorString):
        os.makedirs(outputPath + "/" + TitleAndAuthorString)
    print("SUCCESS: Moving " + TitleAndAuthorString)
    os.rename(file, outputPath + "/" + TitleAndAuthorString + "/" + TitleAndAuthorString + extension)
    # My desired file output path is <BooksDir>/<Title> - <Author>/<Title> - <Author>.{pdf,epub,etc}
# There was an issue parsing the file, let's just move it to an `issues` folder to be manually looked at later
else:
    print("WARN: Moving " + getFileName(file) + " to issues folder")
    os.rename(file, issuesPath + "/" + getFileName(file))
    continue
```

`os.makedirs(...)` creates the directory if needed

`os.rename(...)` takes the existing file at the specified path, and then the final (absolute) path for the file. So in this case it’s `<output-directory>/+ "/" + TitleAndAuthorString + "/" + TitleAndAuthorString + extension`

### Putting it All Together

```python
def main():
    inputPath = os.environ["BOOKSORT_INPUT_PATH"] or "/Users/bvia/Development/Personal/booksort/issues"
    outputPath = os.environ["BOOKSORT_OUTPUT_PATH"] or "/Users/bvia/Development/Personal/booksort/outputs"
    issuesPath = os.environ["BOOKSORT_ISSUES_PATH"] or "/Users/bvia/Development/Personal/booksort/issues"
    sort_books(inputPath, outputPath, issuesPath)
```

Give it a whirl with a call to `main()` at the end of the file and you’re off.

This script isn’t perfect, sometimes the rename fails to write to the specified path for reason I can’t figure out, but it’s helped save me many hours of manual organization, and isn’t that one of our favorite parts of programming after all?

## Thanks!

Thanks for reading. Hope this maybe made Python more accessible if you haven’t used it before, or you learned a new use case for it. Once again the full script file is here: [https://github.com/BrianVia/booksort/blob/main/book-sort.py](https://github.com/BrianVia/booksort/blob/main/book-sort.py)

I'm Brian. A fullstack software engineer at Clearcover.

If you want to check out my [self hosted blog for more it’s here](https://brianvia.blog/).

You can follow me on [Twitter](https://twitter.com/Brian_Via) and [GitHub](https://github.com/BrianVia) as well!
