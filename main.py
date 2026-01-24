def add_student():
    with open("students.txt", "a") as f:
        roll = input("Enter Roll No: ")
        name = input("Enter Name: ")
        marks = input("Enter Marks: ")
        f.write(f"{roll},{name},{marks}\n")
    print("Student added successfully!")

def view_students():
    try:
        with open("students.txt", "r") as f:
            print("\nRoll | Name | Marks")
            print("-------------------")
            for line in f:
                roll, name, marks = line.strip().split(",")
                print(f"{roll} | {name} | {marks}")
    except FileNotFoundError:
        print("No records found.")

def search_student():
    roll_no = input("Enter Roll No to search: ")
    found = False
    with open("students.txt", "r") as f:
        for line in f:
            roll, name, marks = line.strip().split(",")
            if roll == roll_no:
                print(f"Found: {roll} | {name} | {marks}")
                found = True
                break
    if not found:
        print("Student not found.")

def delete_student():
    roll_no = input("Enter Roll No to delete: ")
    lines = []
    found = False
    with open("students.txt", "r") as f:
        lines = f.readlines()

    with open("students.txt", "w") as f:
        for line in lines:
            roll, name, marks = line.strip().split(",")
            if roll != roll_no:
                f.write(line)
            else:
                found = True

    if found:
        print("Student deleted successfully.")
    else:
        print("Student not found.")

while True:
    print("\n--- Student Management System ---")
    print("1. Add Student")
    print("2. View Students")
    print("3. Search Student")
    print("4. Delete Student")
    print("5. Exit")

    choice = input("Enter choice: ")

    if choice == "1":
        add_student()
    elif choice == "2":
        view_students()
    elif choice == "3":
        search_student()
    elif choice == "4":
        delete_student()
    elif choice == "5":
        break
    else:
        print("Invalid choice!")
