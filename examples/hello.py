# TypeGhost works with any language — directives adapt to the comment style.
def greet(name: str) -> str:
    return f"Hello, {name}!"
#~ pause 600

#~ checkpoint before-the-punchline
if __name__ == "__main__":
    print(greet("PyCon"))
